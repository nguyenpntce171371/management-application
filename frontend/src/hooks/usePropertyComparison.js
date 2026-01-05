import { useState, useEffect, useRef, useCallback } from "react";
import { indexedDBService } from "../services/indexedDBService";
import { v4 as uuidv4 } from 'uuid';

export function usePropertyComparison(appraisalId, appraisalProperties, properties) {
    const [appraisalPropertiesData, setAppraisalPropertiesData] = useState([]);
    const [comparisonsData, setComparisonsData] = useState([]);
    const [constructionWorks, setConstructionWorks] = useState([]);

    const prevAppraisalIdsRef = useRef([]);
    const prevComparisonIdsRef = useRef([]);
    const updateQueueRef = useRef([]);
    const saveTimeoutRef = useRef(null);

    const latestDataRef = useRef({ appraisals: [], comparisons: [] });

    useEffect(() => {
        latestDataRef.current = {
            appraisals: appraisalPropertiesData,
            comparisons: comparisonsData
        };
    }, [appraisalPropertiesData, comparisonsData]);

    const recalculateComparison = useCallback((comp, appraisalLand) => {
        const percent = parseFloat(comp.percent) || 0;
        const price = Number(comp.price) || 0;
        const qualityRemainingPercent = parseFloat(comp.qualityRemainingPercent) || 0;

        comp.constructionValue = (Number(comp.usableArea) || 0) * (Number(comp.constructionUnitPrice) || 0) * (qualityRemainingPercent / 100);
        comp.estimatedPrice = (percent / 100) * price;
        comp.landUseRightUnitPrice = (Number(comp.estimatedPrice) - Number(comp.constructionValue)) / (Number(comp.area) || 1);
        let totalPriceDifference = 0;
        const baseLand = appraisalLand?.[0];

        if (baseLand && comp.land?.length > 0) {
            const basePrice = Number(baseLand.ontLandPrice) || 0;
            comp.land.forEach(land => {
                if (land.landType !== baseLand.landType) {
                    const adjPrice = Number(land.ontLandPrice) || 0;
                    const adjArea = Number(land.landArea) || 0;
                    totalPriceDifference += (basePrice - adjPrice) * adjArea;
                }
            });
        }
        comp.adjustedLandUnitPrice = (comp.estimatedPrice + totalPriceDifference - comp.constructionValue) / (comp.area || 1);
        const adjustmentRates = [comp.environmentRate, comp.businessRate, comp.shapeRate, comp.areaRate, comp.sizeRate, comp.locationRate].map(rate => parseFloat(rate) || 0);
        const totalAdjustment = adjustmentRates.reduce((sum, rate) => sum + rate, 0);
        comp.guidedPrice = comp.adjustedLandUnitPrice * (1 + totalAdjustment / 100);

        return comp;
    }, []);

    const calculateGuidedPriceForAppraisal = useCallback((appraisal, allComparisons) => {
        const selectedCompIds = appraisal.selectedComparisons || [];
        if (selectedCompIds.length === 0) return 0;

        const selectedComps = allComparisons.filter(comp => selectedCompIds.includes(comp._id || comp.id));
        if (selectedComps.length === 0) return 0;

        const totalGuidedPrice = selectedComps.reduce((sum, comp) => sum + (comp.guidedPrice || 0), 0);

        return totalGuidedPrice / selectedComps.length;
    }, []);

    const recalculateAll = useCallback((updatedAppraisals, updatedComparisons) => {
        const compToAppraisalMap = new Map();

        updatedAppraisals.forEach(ap => {
            const selectedIds = ap.selectedComparisons || [];
            selectedIds.forEach(compId => {
                compToAppraisalMap.set(compId, ap);
            });
        });

        const recalculatedComparisons = updatedComparisons.map(comp => {
            const compId = comp._id || comp.id;
            const relatedAppraisal = compToAppraisalMap.get(compId);

            if (relatedAppraisal) {
                return recalculateComparison({ ...comp }, relatedAppraisal.land);
            }

            return comp;
        });

        const recalculatedAppraisals = updatedAppraisals.map(ap => {
            const newAp = { ...ap };
            newAp.guidedPriceAverage = calculateGuidedPriceForAppraisal(newAp, recalculatedComparisons);
            return newAp;
        });

        return { appraisals: recalculatedAppraisals, comparisons: recalculatedComparisons };
    }, [recalculateComparison, calculateGuidedPriceForAppraisal]);

    const batchSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const queue = [...updateQueueRef.current];
            updateQueueRef.current = [];

            if (queue.length === 0) return;

            await Promise.all(queue.map(item => {
                if (item.type === "construction") {
                    return indexedDBService.saveConstructionWork(item.data);
                } else {
                    return indexedDBService.saveProperty(item.data);
                }
            }));
        }, 300);
    }, []);

    useEffect(() => {
        const currentSnapshot = (appraisalProperties ?? []).map(p => ({
            id: p._id || p.id,
            selectedComparisons: JSON.stringify((p.selectedComparisons || []).sort())
        }));

        const currentComparisonIds = properties?.map(p => p._id || p.id).sort().join(',') || '';

        const appraisalsChanged = JSON.stringify(currentSnapshot) !== JSON.stringify(prevAppraisalIdsRef.current);
        const comparisonsChanged = currentComparisonIds !== prevComparisonIdsRef.current;

        if (appraisalsChanged) {
            const updatedAppraisals = appraisalProperties.map(p => ({
                ...p,
                appraisalId,
                _id: p._id || p.id || uuidv4(),
                selectedComparisons: p.selectedComparisons || []
            }));

            setAppraisalPropertiesData(updatedAppraisals);
            prevAppraisalIdsRef.current = currentSnapshot;

            setTimeout(() => {
                const currentComps = latestDataRef.current.comparisons.length > 0 ? latestDataRef.current.comparisons : properties?.map(p => ({ ...p, _id: p._id || p.id || uuidv4() })) || [];

                const { appraisals: recalcAppraisals, comparisons: recalcComparisons } = recalculateAll(updatedAppraisals, currentComps);

                setComparisonsData(recalcComparisons);
                setAppraisalPropertiesData(recalcAppraisals);

                recalcComparisons.forEach(comp => {
                    updateQueueRef.current.push({ type: "property", data: comp });
                });
                recalcAppraisals.forEach(ap => {
                    updateQueueRef.current.push({ type: "property", data: ap });
                });

                batchSave();
            }, 0);
        }

        if (comparisonsChanged) {
            setComparisonsData(properties?.map(p => ({ ...p, _id: p._id || p.id || uuidv4() })) || []);
            prevComparisonIdsRef.current = currentComparisonIds;
        }
    }, [appraisalProperties, properties, recalculateAll, batchSave]);

    useEffect(() => {
        if (!appraisalId) return;
        indexedDBService.getConstructionWorksByAppraisal(appraisalId).then(setConstructionWorks);
    }, [appraisalId]);

    const getLandByType = useCallback((lands, landType) => {
        return lands?.find(land => land.landType === landType);
    }, []);

    const updateLandByType = useCallback((lands = [], landType, field, value) => {
        const existingIndex = lands.findIndex(land => land.landType === landType);

        if (existingIndex >= 0) {
            const updated = [...lands];
            updated[existingIndex] = {
                ...updated[existingIndex],
                [field]: value
            };
            return updated;
        } else {
            return [...lands, {
                landType,
                streetDescription: "",
                location: "",
                landArea: "",
                ontLandPrice: "",
                [field]: value
            }];
        }
    }, []);

    const cleanupLands = useCallback((lands = [], landTypes = []) => {
        return lands.filter(land => landTypes.includes(land.landType));
    }, []);

    const setLandAreaIfSingle = useCallback((totalArea, lands = []) => {
        if (lands.length === 1) {
            lands[0].landArea = totalArea;
        }
        return lands;
    }, []);

    const updateNestedField = useCallback((obj, field, value) => {
        const keys = field.split(".");
        let temp = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            temp[keys[i]] = temp[keys[i]] || {};
            temp = temp[keys[i]];
        }
        temp[keys.at(-1)] = value;
    }, []);

    const processAppraisalUpdate = useCallback((appraisal, field, value) => {
        const updated = { ...appraisal };

        if (field.startsWith("land.")) {
            const parts = field.split(".");
            const landType = parts[1];
            const landField = parts[2];

            updated.land = updateLandByType(updated.land, landType, landField, value);

            if (landField === "landArea" && updated.land.length === 1) {
                updated.area = value;
            }
        } else if (field === "landTypes") {
            updated.land = updated.land || [];
            const oldLandTypes = updated.land?.map(l => l.landType) || [];
            const newLandTypes = value;

            updated.land = cleanupLands(updated.land, newLandTypes);

            newLandTypes.forEach(landType => {
                if (!oldLandTypes.includes(landType)) {
                    updated.land = updateLandByType(updated.land, landType, "landArea", "");
                }
            });

            setLandAreaIfSingle(updated.area, updated.land);
        } else if (field === "area") {
            updateNestedField(updated, field, value);
            setLandAreaIfSingle(value, updated.land);
        } else if (field === "selectedComparisons") {
            updated.selectedComparisons = value;
        } else {
            updateNestedField(updated, field, value);
        }

        return updated;
    }, [updateLandByType, setLandAreaIfSingle, cleanupLands, updateNestedField]);

    const handleComparisonChange = useCallback(async (_id, field, value) => {
        setComparisonsData(prevComparisons => {
            const updated = prevComparisons.map(comp => {
                if (comp._id !== _id) return comp;

                const newComp = { ...comp };

                if (field.startsWith("land.")) {
                    const parts = field.split(".");
                    const landType = parts[1];
                    const landField = parts[2];

                    if (field.endsWith(".ontLandPrice")) {
                        return comp;
                    } else {
                        newComp.land = updateLandByType(newComp.land, landType, landField, value);
                        if (landField === "landArea" && newComp.land.length === 1) {
                            newComp.area = value;
                        }
                    }
                } else if (field === "landTypes") {
                    newComp.land = newComp.land || [];
                    const oldLandTypes = newComp.land?.map(l => l.landType) || [];
                    const newLandTypes = value;

                    newComp.land = cleanupLands(newComp.land, newLandTypes);

                    newLandTypes.forEach(landType => {
                        if (!oldLandTypes.includes(landType)) {
                            newComp.land = updateLandByType(newComp.land, landType, "landArea", "");
                        }
                    });

                    setLandAreaIfSingle(newComp.area, newComp.land);
                } else if (field === "convertibleAreaLimit") {
                    return comp;
                } else {
                    updateNestedField(newComp, field, value);
                    if (field === "area") {
                        setLandAreaIfSingle(newComp.area, newComp.land);
                    }
                }

                return newComp;
            });

            let finalUpdated = updated;

            if (field.endsWith(".ontLandPrice")) {
                const parts = field.split(".");
                const landType = parts[1];

                finalUpdated = updated.map(comp => {
                    const hasLandType = comp.land?.some(l => l.landType === landType);
                    if (hasLandType) {
                        const existingLand = comp.land?.find(l => l.landType === landType);
                        if (existingLand && !existingLand.ontLandPrice) {
                            const newComp = { ...comp };
                            newComp.land = updateLandByType(comp.land, landType, "ontLandPrice", value);
                            return newComp;
                        }
                    }
                    return comp;
                });
            } else if (field === "convertibleAreaLimit") {
                finalUpdated = updated.map(comp => ({
                    ...comp,
                    convertibleAreaLimit: comp.convertibleAreaLimit ? comp.convertibleAreaLimit : value
                }));
            }

            return finalUpdated;
        });

        if (field.endsWith(".ontLandPrice") || field === "convertibleAreaLimit") {
            setAppraisalPropertiesData(prev => {
                const parts = field.split(".");
                const landType = parts[1];

                return prev.map(ap => {
                    if (field.endsWith(".ontLandPrice")) {
                        const hasLandType = ap.land?.some(l => l.landType === landType);
                        if (hasLandType) {
                            const existingLand = ap.land?.find(l => l.landType === landType);
                            if (existingLand && !existingLand.ontLandPrice) {
                                const newAp = { ...ap };
                                newAp.land = updateLandByType(ap.land, landType, "ontLandPrice", value);
                                return newAp;
                            }
                        }
                    } else if (field === "convertibleAreaLimit") {
                        return { ...ap, convertibleAreaLimit: ap.convertibleAreaLimit ? ap.convertibleAreaLimit : value };
                    }
                    return ap;
                });
            });
        }

        setTimeout(() => {
            const currentAppraisals = latestDataRef.current.appraisals;
            const currentComparisons = latestDataRef.current.comparisons;

            const { appraisals: recalcAppraisals, comparisons: recalcComparisons } = recalculateAll(currentAppraisals, currentComparisons);

            setComparisonsData(recalcComparisons);
            setAppraisalPropertiesData(recalcAppraisals);

            recalcComparisons.forEach(comp => {
                updateQueueRef.current.push({ type: "property", data: comp });
            });
            recalcAppraisals.forEach(ap => {
                updateQueueRef.current.push({ type: "property", data: ap });
            });

            batchSave();
        }, 0);

    }, [updateLandByType, setLandAreaIfSingle, cleanupLands, updateNestedField, recalculateAll, batchSave]);

    const handleAppraisalChange = useCallback(async (_id, field, value) => {
        setAppraisalPropertiesData(prev => {
            const targetIndex = prev.findIndex(ap => (ap.id === _id || ap._id === _id));

            if (targetIndex === -1) {
                return prev;
            }

            const updated = [...prev];
            const targetAppraisal = processAppraisalUpdate(updated[targetIndex], field, value);
            updated[targetIndex] = targetAppraisal;

            return updated;
        });

        if (field.endsWith(".ontLandPrice") || field === "convertibleAreaLimit") {
            setComparisonsData(prevComps => {
                const currentAppraisals = latestDataRef.current.appraisals;
                const changedAppraisal = currentAppraisals.find(ap => ap.id === _id || ap._id === _id);

                if (!changedAppraisal) return prevComps;

                const selectedCompIds = changedAppraisal.selectedComparisons || [];
                const parts = field.split(".");
                const landType = parts[1];

                return prevComps.map(comp => {
                    const isSelected = selectedCompIds.includes(comp._id || comp.id);
                    if (!isSelected) return comp;

                    const newComp = { ...comp };

                    if (field.endsWith(".ontLandPrice")) {
                        const hasLandType = comp.land?.some(l => l.landType === landType);
                        if (hasLandType) {
                            const existingLand = comp.land?.find(l => l.landType === landType);
                            if (existingLand && !existingLand.ontLandPrice) {
                                newComp.land = updateLandByType(comp.land, landType, "ontLandPrice", value);
                            }
                        }
                    } else if (field === "convertibleAreaLimit") {
                        newComp.convertibleAreaLimit = comp.convertibleAreaLimit ? comp.convertibleAreaLimit : value;
                    }

                    return newComp;
                });
            });
        }

        setTimeout(() => {
            const currentAppraisals = latestDataRef.current.appraisals;
            const currentComparisons = latestDataRef.current.comparisons;

            const { appraisals: recalcAppraisals, comparisons: recalcComparisons } = recalculateAll(currentAppraisals, currentComparisons);

            setComparisonsData(recalcComparisons);
            setAppraisalPropertiesData(recalcAppraisals);

            recalcComparisons.forEach(comp => {
                updateQueueRef.current.push({ type: "property", data: comp });
            });
            recalcAppraisals.forEach(ap => {
                updateQueueRef.current.push({ type: "property", data: ap });
            });

            batchSave();
        }, 0);

    }, [processAppraisalUpdate, updateLandByType, recalculateAll, batchSave]);

    const addConstruction = useCallback(() => {
        const newWork = {
            id: uuidv4(),
            appraisalId,
            description: "",
            qualityRemaining: "",
            area: "",
            unitPrice: ""
        };

        setConstructionWorks(prev => {
            const updated = [...prev, newWork];
            updateQueueRef.current.push({ type: "construction", data: newWork });
            return updated;
        });

        batchSave();
    }, [batchSave]);

    const deleteConstruction = useCallback((id) => {
        setConstructionWorks(prev => {
            const updated = prev.filter(w => w.id !== id);
            indexedDBService.deleteConstructionWork(id);
            return updated;
        });
    }, []);

    const handleConstructionChange = useCallback((id, field, value) => {
        setConstructionWorks(prev => {
            const updated = prev.map(w =>
                w.id === id ? { ...w, [field]: value } : w
            );

            updateQueueRef.current.push(
                { type: "construction", data: updated.find(w => w.id === id) }
            );

            return updated;
        });

        batchSave();
    }, [batchSave]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    return {
        appraisalPropertiesData,
        setAppraisalPropertiesData,
        comparisonsData,
        setComparisonsData,
        constructionWorks,
        setConstructionWorks,
        handleComparisonChange,
        handleAppraisalChange,
        getLandByType,
        addConstruction,
        deleteConstruction,
        handleConstructionChange,
        calculateGuidedPriceForAppraisal
    };
}