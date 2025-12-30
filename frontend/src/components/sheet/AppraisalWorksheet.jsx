import { useEffect, useState, useCallback, useMemo } from "react";
import axiosInstance from "../../services/axiosInstance";
import { Download, Plus, X, Save, ListRestart } from "lucide-react";
import styles from "./AppraisalWorksheet.module.css";
import { indexedDBService } from "../../services/indexedDBService";
import { v4 as uuidv4 } from "uuid";
import TotalSheet from "./TotalSheet";
import AdjustmentSheet from "./AdjustmentSheet";
import BasicSheet from "./BasicSheet";
import ComparisonPropertySelector from "../common/ComparisonPropertySelector";
import { useParams } from "react-router-dom";
import { usePropertyComparison } from "../../hooks/usePropertyComparison";
import { exportPropertyComparisonToExcel } from "../../hooks/excelExport";
import provinces from "../../data/vietnam-provinces.json";

function AppraisalWorksheet() {
    const { id } = useParams();
    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [ward, setWard] = useState("");
    const [street, setStreet] = useState("");
    const [properties, setProperties] = useState([]);
    const [appraisalProperties, setAppraisalProperties] = useState([]);
    const [activeTab, setActiveTab] = useState("");
    const [tabs, setTabs] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const [selectedComparisons, setSelectedComparisons] = useState({});
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);

    const currentTab = useMemo(() =>
        tabs.find(t => t.id === activeTab),
        [tabs, activeTab]
    );

    const normalizeLandParcel = useCallback((p) => {
        if (!p || !provinces.length) return "";
        const removePrefix = (str = "") => str.replace(/^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\s+/i, "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const province = provinces.find(x => removePrefix(x.name).toLowerCase() === removePrefix(p.province).toLowerCase());
        if (!province) return "";
        const district = province?.districts?.find(x => removePrefix(x.name).toLowerCase() === removePrefix(p.district).toLowerCase());
        if (!district) return province.name;
        const ward = district?.wards?.find(x => removePrefix(x.name).toLowerCase() === removePrefix(p.ward).toLowerCase());
        if (!ward) return `${district.name}, ${province.name}`;
        return `${ward.name}, ${district.name}, ${province.name}`;
    }, [provinces]);

    const convertAddress = async (address) => {
        const response = await axiosInstance.post("/api/staff/convert-address", { address });
        return response?.data?.data?.new || address;
    };

    const loadAppraisalFromAPI = useCallback(async () => {
        const response = await axiosInstance.get(`/api/staff/appraisals/${id}`);
        const appraisalData = response.data.data;
        const assets = appraisalData.assets || [];
        const constructions = appraisalData.constructions || [];

        const processedAssets = await Promise.all(assets.map(async (asset) => {
            const assetId = asset.id || asset._id;
            const selectedComparisonIds = (asset.selectedComparisons || []).map(comp => comp.id || comp._id).filter(Boolean);
            const apiAssetData = { ...asset, id: assetId, _id: assetId, appraisalId: id, isComparison: false, selectedComparisons: selectedComparisonIds };
            const existingAsset = await indexedDBService.getPropertyById(assetId);
            let mergedAsset = existingAsset ? { ...apiAssetData, ...existingAsset } : apiAssetData;
            await indexedDBService.saveProperty(mergedAsset);
            return { asset: mergedAsset, comparisonIds: selectedComparisonIds };
        }));

        await Promise.all(constructions.map(async (construction) => {
            const constructionId = construction.id || construction._id;
            const apiConstructionData = { ...construction, id: constructionId, _id: constructionId, appraisalId: id };
            const existingConstruction = await indexedDBService.getConstructionWorkById(constructionId);
            const mergedConstruction = existingConstruction ? { ...apiConstructionData, ...existingConstruction } : apiConstructionData;
            await indexedDBService.saveConstructionWork(mergedConstruction);
        }));

        for (const { asset, comparisonIds } of processedAssets) {
            const apiAsset = assets.find(a => (a.id || a._id) === asset.id);
            const apiComparisons = apiAsset?.selectedComparisons || [];

            for (const compId of comparisonIds) {
                const comparisonExtraData = apiComparisons.find(comp => (comp.id || comp._id) === compId);
                const compRes = await axiosInstance.get(`/api/real-estate/${compId}`);
                const compData = compRes.data.data;
                const mergedCompData = { ...compData, id: compData._id || compId, _id: compData._id || compId, isComparison: true, ...(comparisonExtraData || {}) };
                const existingComp = await indexedDBService.getPropertyById(compId);
                const finalCompData = existingComp ? { ...mergedCompData, ...existingComp } : mergedCompData;
                await indexedDBService.saveProperty(finalCompData);
            }
        }

        return processedAssets.map(item => item.asset);
    }, [id]);

    const normalizeProperty = useCallback(async (p) => {
        const now = new Date();
        const defaultTime = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
        const address = normalizeLandParcel(p);
        const newAddress = p.location?.landParcel ? "" : await convertAddress(address);

        return {
            ...p,
            _id: p._id || p.id || uuidv4(),
            transactionTime: p.transactionTime || defaultTime,
            source: p.source || (p.location?.lat && p.location?.lng ? "Thu thập thực tế" : ""),
            contactInfo: p.contactInfo || p.contacts?.[0]?.phone || "",
            legalStatus: p.legalStatus ? "Giấy chứng nhận QSDĐ" : "",
            location: {
                ...p.location,
                landParcel: p.location?.landParcel
                    || `Tài sản tọa lạc tại ${address} (nay ${newAddress})`,
                description: p.location?.description || `TSSS tiếp giáp đường ${p.street}`
            },
            currentUsageStatus: p.currentUsageStatus || (p.propertyType?.includes("Nhà") ? "Có CTXD" : "Đất trống"),
            percent: p.percent || "100%",
            qualityRemainingPercent: p.qualityRemainingPercent ?? "100%",
            locationRate: p.locationRate || "0%",
            sizeRate: p.sizeRate || "0%",
            areaRate: p.areaRate || "0%",
            shapeRate: p.shapeRate || "0%",
            businessRate: p.businessRate || "0%",
            environmentRate: p.environmentRate || "0%",
        };
    }, [normalizeLandParcel]);

    const loadInitialData = useCallback(async () => {
        let allIndexedProperties = await indexedDBService.getAllProperties();

        const hasCurrentAppraisal = allIndexedProperties.some(
            p => !p.isComparison && p.appraisalId === id
        );

        if (id && !hasCurrentAppraisal) {
            await loadAppraisalFromAPI();
            allIndexedProperties = await indexedDBService.getAllProperties();
        }

        const selectedIds = [...new Set(
            allIndexedProperties
                .filter(p =>
                    !p.isComparison &&
                    p.appraisalId === id &&
                    Array.isArray(p.selectedComparisons)
                )
                .flatMap(p => p.selectedComparisons)
        )];

        for (const compId of selectedIds) {
            const exists = allIndexedProperties.find(p => (p.id === compId || p._id === compId) && p.isComparison);
            if (!exists) {
                const res = await axiosInstance.get(`/api/real-estate/${compId}`);
                const data = {
                    ...res.data.data,
                    id: res.data.data._id,
                    _id: res.data.data._id,
                    isComparison: true
                };
                await indexedDBService.saveProperty(data);
                allIndexedProperties.push(data);
            }
        }

        const comparisonProperties = allIndexedProperties.filter(p => p.isComparison);

        const normalizedComparisons = await Promise.all(
            comparisonProperties.map(async (p) => {
                const normalized = await normalizeProperty(p);
                await indexedDBService.saveProperty(normalized);
                return normalized;
            })
        );

        setProperties(normalizedComparisons);

        let appraisals = allIndexedProperties.filter(
            p => !p.isComparison && p.appraisalId === id
        );

        appraisals.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setAppraisalProperties(appraisals);

        const selections = {};
        for (const appraisal of appraisals) {
            if (Array.isArray(appraisal.selectedComparisons)) {
                selections[appraisal.id] = appraisal.selectedComparisons.map(sc => {
                    return typeof sc === "object" ? (sc.id || sc._id) : sc;
                }).filter(Boolean);
            } else {
                selections[appraisal.id] = [];
            }
        }
        setSelectedComparisons(selections);

        const newTabs = [];
        appraisals.forEach((appraisal, index) => {
            newTabs.push({
                id: `basic-${appraisal.id}`,
                label: `Thửa ${index + 1} - Thông tin cơ bản`,
                type: "basic",
                appraisalId: appraisal.id
            });
            newTabs.push({
                id: `adjustment-${appraisal.id}`,
                label: `Thửa ${index + 1} - Điều chỉnh`,
                type: "adjustment",
                appraisalId: appraisal.id
            });
        });

        if (appraisals.length > 0) {
            newTabs.push({
                id: "total",
                label: "Tổng cộng",
                type: "total"
            });
        }

        setTabs(newTabs);

        if (!activeTab && newTabs.length > 0) {
            const savedTab = localStorage.getItem("activeTab");
            const tabExists = savedTab && newTabs.find(t => t.id === savedTab);
            setActiveTab(tabExists ? savedTab : newTabs[0].id);
        }

        setIsInitialLoad(false);
    }, [normalizeProperty, activeTab, id, loadAppraisalFromAPI]);

    useEffect(() => {
        if (isInitialLoad) {
            loadInitialData();
        }
    }, [isInitialLoad, loadInitialData]);

    useEffect(() => {
        if (activeTab) {
            localStorage.setItem("activeTab", activeTab);
        }
    }, [activeTab]);

    const handleDeleteAppraisal = useCallback(async (id) => {
        await indexedDBService.deleteProperty(id);

        setAppraisalProperties(prev => prev.filter(a => a.id !== id));
        setSelectedComparisons(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });

        setTabs(prev => prev.filter(t => t.appraisalId !== id));

        if (currentTab?.appraisalId === id) {
            setActiveTab("");
            localStorage.removeItem("activeTab");
        }
    }, [currentTab, loadInitialData]);

    const handleAddEmptyAppraisal = useCallback(async () => {
        setShowAddDialog(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setShowAddDialog(false);
    }, []);

    const handleConfirmAdd = useCallback(async () => {
        if (!province || !district || !ward || !street) {
            alert("Vui lòng điền đầy đủ thông tin");
            return;
        }

        const address = `${ward}, ${district}, ${province}`;
        const newAddress = await convertAddress(address);
        const empty = {
            id: uuidv4(),
            appraisalId: id,
            isComparison: false,
            createdAt: Date.now(),
            selectedComparisons: [],
            province: province,
            district: district,
            ward: ward,
            street: street,
            location: {
                landParcel: `${address} (nay ${newAddress})`,
                description: `TSTĐ tiếp giáp đường ${street}`
            },
        };

        await indexedDBService.saveProperty(empty);

        setAppraisalProperties(prev => [...prev, empty]);
        setSelectedComparisons(prev => ({ ...prev, [empty.id]: [] }));

        const index = appraisalProperties.length;
        const newTabs = [
            {
                id: `basic-${empty.id}`,
                label: `Thửa ${index + 1} - Thông tin cơ bản`,
                type: "basic",
                appraisalId: empty.id
            },
            {
                id: `adjustment-${empty.id}`,
                label: `Thửa ${index + 1} - Điều chỉnh`,
                type: "adjustment",
                appraisalId: empty.id
            }
        ];

        setTabs(prev => {
            const withoutTotal = prev.filter(t => t.type !== "total");
            return [...withoutTotal, ...newTabs, { id: "total", label: "Tổng cộng", type: "total" }];
        });

        handleCloseDialog();
    }, [province, district, ward, street, appraisalProperties.length, handleCloseDialog]);

    const handleToggleComparison = useCallback(async (appraisalId, comparisonId) => {
        const currentList = selectedComparisons[appraisalId] || [];
        const isAdding = !currentList.includes(comparisonId);
        const updatedList = isAdding ? [...currentList, comparisonId] : currentList.filter(id => id !== comparisonId);

        if (isAdding) {
            let property = await indexedDBService.getPropertyById(comparisonId);

            if (!property) {
                const res = await axiosInstance.get(`/api/real-estate/${comparisonId}`);
                property = {
                    ...res.data.data,
                    id: res.data.data._id,
                    _id: res.data.data._id,
                    isComparison: true
                };
            }

            const normalized = await normalizeProperty(property);
            await indexedDBService.saveProperty(normalized);

            setProperties(prev => {
                const exists = prev.find(p => p.id === comparisonId || p._id === comparisonId);
                if (exists) {
                    return prev.map(p =>
                        (p.id === comparisonId || p._id === comparisonId) ? normalized : p
                    );
                }
                return [...prev, normalized];
            });
        }

        setSelectedComparisons(prev => ({ ...prev, [appraisalId]: updatedList }));

        const appraisal = appraisalProperties.find(a => a.id === appraisalId);
        if (appraisal) {
            const updatedAppraisal = { ...appraisal, selectedComparisons: updatedList };
            await indexedDBService.saveProperty(updatedAppraisal);
            setAppraisalProperties(prev => prev.map(a => a.id === appraisalId ? updatedAppraisal : a));
        }
    }, [selectedComparisons, appraisalProperties, normalizeProperty]);

    const handleSaveName = useCallback(async (ap, newName) => {
        const updated = { ...ap, name: newName.trim() };
        await indexedDBService.saveProperty(updated);
        setAppraisalProperties(prev => prev.map(a => a.id === ap.id ? updated : a));
        setEditingId(null);
        setEditingName("");
    }, []);

    const { appraisalPropertiesData, setAppraisalPropertiesData, comparisonsData, setComparisonsData, handleComparisonChange, handleAppraisalChange, getLandByType, constructionWorks, setConstructionWorks, addConstruction, deleteConstruction, handleConstructionChange } = usePropertyComparison(id, appraisalProperties, properties);

    const currentAppraisalData = useMemo(() => (
        appraisalPropertiesData.find(a => a.id === currentTab?.appraisalId) || {}
    ), [appraisalPropertiesData, currentTab]);

    const currentComparisonsData = useMemo(() => {
        if (!currentTab?.appraisalId) return [];
        const selectedIds = selectedComparisons[currentTab.appraisalId] || [];
        return selectedIds.map(id => comparisonsData.find(c => (c.id === id || c._id === id))).filter(Boolean);
    }, [currentTab, selectedComparisons, comparisonsData]);

    const exportToExcel = useCallback(async () => {
        const exportAppraisals = appraisalProperties.map(appraisal => {
            const calculatedData = appraisalPropertiesData.find(a => a.id === appraisal.id) || {};
            return { ...calculatedData, ...appraisal, selectedComparisons: selectedComparisons[appraisal.id] || [] };
        });
        const exportComparisons = comparisonsData;
        await exportPropertyComparisonToExcel(exportAppraisals, exportComparisons, constructionWorks, getLandByType);
    }, [appraisalProperties, appraisalPropertiesData, comparisonsData, constructionWorks, selectedComparisons, getLandByType]);

    const handleSaveAppraisal = useCallback(async () => {
        const allIndexedProperties = await indexedDBService.getAllProperties();
        const assets = appraisalPropertiesData.map(asset => ({
            id: asset.id,
            _id: asset._id,
            name: asset.name || "Chưa xác định",
            area: asset.area,
            businessAdvantage: asset.businessAdvantage,
            convertibleAreaLimit: asset.convertibleAreaLimit,
            currentUsageStatus: asset.currentUsageStatus,
            district: asset.district,
            guidedPrice: asset.guidedPrice,
            guidedPriceAverage: asset.guidedPriceAverage,
            infrastructure: asset.infrastructure,
            land: (asset.land || []).map(l => ({
                landType: l.landType,
                streetDescription: l.streetDescription,
                location: l.location,
                landArea: l.landArea,
                ontLandPrice: l.ontLandPrice
            })),
            legalStatus: asset.legalStatus,
            length: asset.length,
            livingEnvironment: asset.livingEnvironment,
            location: {
                description: asset.location?.description,
                landParcel: asset.location?.landParcel
            },
            province: asset.province,
            selectedComparisons: (selectedComparisons[asset.id] || []).map(compId => {
                const comp = allIndexedProperties.find(p => p.id === compId || p._id === compId);
                return {
                    id: comp?.id,
                    _id: comp?._id,
                    areaRate: comp?.areaRate,
                    businessRate: comp?.businessRate,
                    environmentRate: comp?.environmentRate,
                    isComparison: true,
                    adjustedLandUnitPrice: comp?.adjustedLandUnitPrice,
                    locationRate: comp?.locationRate,
                    shapeRate: comp?.shapeRate,
                    sizeRate: comp?.sizeRate,
                    guidedPrice: comp?.guidedPrice,

                    area: comp?.area,
                    businessAdvantage: comp?.businessAdvantage,
                    constructionUnitPrice: comp?.constructionUnitPrice,
                    constructionValue: comp?.constructionValue,
                    contactInfo: comp?.contactInfo,
                    convertibleAreaLimit: comp?.convertibleAreaLimit,
                    currentUsageStatus: comp?.currentUsageStatus,
                    estimatedPrice: comp?.estimatedPrice,
                    infrastructure: comp?.infrastructure,
                    land: comp?.land?.map(l => ({
                        landArea: l.landArea,
                        landType: l.landType,
                        location: l.location,
                        ontLandPrice: l.ontLandPrice,
                        streetDescription: l.streetDescription
                    })),
                    landUseRightUnitPrice: comp?.landUseRightUnitPrice,
                    legalStatus: comp?.legalStatus,
                    length: comp?.length,
                    livingEnvironment: comp?.livingEnvironment,
                    location: {
                        description: comp?.location.description,
                        landParcel: comp?.location.landParcel,
                        lat: comp?.location.lat,
                        lng: comp?.location.lng
                    },
                    percent: comp?.percent,
                    price: comp?.price,
                    qualityRemainingPercent: comp?.qualityRemainingPercent,
                    shape: comp?.shape,
                    source: comp?.source,
                    transactionTime: comp?.transactionTime,
                    usableArea: comp?.usableArea,
                    width: comp?.width
                };
            }),
            shape: asset.shape,
            street: asset.street,
            ward: asset.ward,
            width: asset.width,
        }));
        const allIndexedConstructionWorks = await indexedDBService.getAllConstructionWorks();
        const constructions = allIndexedConstructionWorks.map(construction => ({
            id: construction?.id,
            area: construction?.area,
            description: construction?.description,
            qualityRemaining: construction?.qualityRemaining,
            unitPrice: construction?.unitPrice
        }));
        const payload = { assets, constructions };

        await axiosInstance.post(`/api/staff/appraisals/assets/${id}`, payload);
    }, [id, appraisalPropertiesData, selectedComparisons]);

    const handleReload = useCallback(async () => {
        const response = await axiosInstance.get(`/api/staff/appraisals/${id}`);
        const appraisalData = response.data.data;
        const assets = appraisalData.assets || [];
        const constructions = appraisalData.constructions || [];
        if (assets.length === 0) {
            await indexedDBService.deletePropertiesByAppraisalId(id);
        }
        if (constructions.length === 0) {
            await indexedDBService.deleteConstructionWorksByAppraisalId(id);
        }
        const processedAssets = await Promise.all(assets.map(async (asset) => {
            const assetId = asset.id || asset._id;
            const selectedComparisonIds = (asset.selectedComparisons || []).map(comp => comp.id || comp._id).filter(Boolean);
            const apiAssetData = { ...asset, id: assetId, _id: assetId, appraisalId: id, isComparison: false, selectedComparisons: selectedComparisonIds };
            const existingAsset = await indexedDBService.getPropertyById(assetId);
            let mergedAsset = existingAsset ? { ...existingAsset, ...apiAssetData } : apiAssetData;
            await indexedDBService.saveProperty(mergedAsset);
            return { asset: mergedAsset, comparisonIds: selectedComparisonIds };
        }));

        const processedConstructions = await Promise.all(constructions.map(async (construction) => {
            const constructionId = construction.id || construction._id;
            const apiConstructionData = { ...construction, id: constructionId, _id: constructionId, appraisalId: id };
            const existingConstruction = await indexedDBService.getConstructionWorkById(constructionId);
            const mergedConstruction = existingConstruction ? { ...existingConstruction, ...apiConstructionData } : apiConstructionData;
            await indexedDBService.saveConstructionWork(mergedConstruction);
            return mergedConstruction;
        }));

        for (const { asset, comparisonIds } of processedAssets) {
            const apiAsset = assets.find(a => (a.id || a._id) === asset.id);
            const apiComparisons = apiAsset?.selectedComparisons || [];

            for (const compId of comparisonIds) {
                const comparisonExtraData = apiComparisons.find(comp => (comp.id || comp._id) === compId);
                const compRes = await axiosInstance.get(`/api/real-estate/${compId}`);
                const compData = compRes.data.data;
                const mergedCompData = { ...compData, id: compData._id || compId, _id: compData._id || compId, isComparison: true, ...(comparisonExtraData || {}) };
                const existingComp = await indexedDBService.getPropertyById(compId);
                const finalCompData = existingComp ? { ...existingComp, ...mergedCompData } : mergedCompData;
                await indexedDBService.saveProperty(finalCompData);
            }
        }
        const updatedAssets = processedAssets.map(item => item.asset);
        setAppraisalPropertiesData(updatedAssets);
        setConstructionWorks(processedConstructions);
        const allComparisons = await indexedDBService.getAllProperties();
        const comparisonProperties = allComparisons.filter(p => p.isComparison);
        setComparisonsData(comparisonProperties);
        const selections = {};
        for (const asset of updatedAssets) {
            if (Array.isArray(asset.selectedComparisons)) {
                selections[asset.id] = asset.selectedComparisons;
            } else {
                selections[asset.id] = [];
            }
        }
        setSelectedComparisons(selections);
        return updatedAssets;
    }, [id, setAppraisalProperties, setConstructionWorks, setProperties, setSelectedComparisons]);

    const selectedProvinceData = useMemo(() => (
        provinces.find(p => p.name === province)
    ), [provinces, province]);

    const districtOptions = useMemo(() => (
        selectedProvinceData?.districts || []
    ), [selectedProvinceData]);

    const selectedDistrictData = useMemo(() => (
        districtOptions.find(d => d.name === district)
    ), [districtOptions, district]);

    const wardOptions = useMemo(() => (
        selectedDistrictData?.wards || []
    ), [selectedDistrictData]);

    const handleProvinceChange = useCallback((e) => {
        setProvince(e.target.value);
        setDistrict("");
        setWard("");
    }, []);

    const handleDistrictChange = useCallback((e) => {
        setDistrict(e.target.value);
        setWard("");
    }, []);

    const handleWardChange = useCallback((e) => {
        setWard(e.target.value);
    }, []);

    const handleStreetChange = useCallback((e) => {
        setStreet(e.target.value);
    }, []);
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerFirstLine}>
                    <h2 className={styles.title}>Thẩm định giá tài sản</h2>
                    <div className={styles.headerActions}>
                        <button className={styles.button} onClick={handleAddEmptyAppraisal} title="Thêm tài sản thẩm định">
                            <Plus size={20} />
                            <span>Thêm TSTĐ</span>
                        </button>
                        <button className={styles.button} onClick={exportToExcel} title="Xuất file Excel">
                            <Download size={20} />
                            <span>Xuất Excel</span>
                        </button>
                        <button className={styles.button} onClick={handleSaveAppraisal} title="Lưu lên hệ thống">
                            <Save size={20} />
                            <span>Lưu</span>
                        </button>
                        <button className={styles.button} onClick={handleReload} title="Tải lại dữ liệu từ hệ thống">
                            <ListRestart size={20} />
                            <span>Tải lại</span>
                        </button>
                    </div>
                </div>

                <span className={styles.subTitle}>Tài sản thẩm định</span>
                <div className={styles.propertiesList}>
                    {appraisalProperties.map((ap, i) => {
                        const isEditing = editingId === ap.id;

                        return (
                            <div key={`${ap.name}-${i}`} className={styles.propertyChip}>
                                {isEditing ? (
                                    <input type="text" value={editingName} autoFocus className={styles.editInput}
                                        onChange={e => setEditingName(e.target.value)}
                                        onBlur={() => handleSaveName(ap, editingName)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleSaveName(ap, editingName);
                                            if (e.key === "Escape") {
                                                setEditingId(null);
                                                setEditingName("");
                                            }
                                        }}
                                    />
                                ) : (
                                    <span onClick={() => { setEditingId(ap.id); setEditingName(ap.name || "") }}>
                                        {ap.name || "Chưa xác định"}
                                    </span>
                                )}
                                <button className={styles.deletePropertyButton} onClick={() => handleDeleteAppraisal(ap.id)} title="Xóa">
                                    <X size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {appraisalProperties.map((ap) => (
                    <ComparisonPropertySelector key={ap.id} appraisal={ap} selectedComparisons={selectedComparisons} onToggleComparison={handleToggleComparison} allCachedProperties={properties} />
                ))}
            </div>

            <div className={styles.tabsWrapper}>
                <div className={styles.tabsList}>
                    {tabs.map(tab => {
                        const appraisal = appraisalProperties.find(a => a.id === tab.appraisalId);
                        const name = appraisal?.name || "Chưa xác định";
                        const label = tab.type === "basic" ? name : tab.type === "adjustment" ? `Điều chỉnh (${name})` : tab.label;

                        return (
                            <button key={tab.id} className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ""}`} onClick={() => setActiveTab(tab.id)}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div className={styles.sheetContent}>
                    {currentTab?.type === "basic" && <BasicSheet appraisalData={currentAppraisalData} comparisonsData={currentComparisonsData} handleComparisonChange={handleComparisonChange} handleAppraisalChange={handleAppraisalChange} getLandByType={getLandByType} />}
                    {currentTab?.type === "adjustment" && <AdjustmentSheet appraisalData={currentAppraisalData} comparisonsData={currentComparisonsData} handleComparisonChange={handleComparisonChange} />}
                    {currentTab?.type === "total" && <TotalSheet appraisalProperties={appraisalPropertiesData} constructionWorks={constructionWorks} addConstruction={addConstruction} deleteConstruction={deleteConstruction} handleConstructionChange={handleConstructionChange} />}
                </div>
            </div>

            {showAddDialog && (
                <div className={styles.dialogOverlay} onClick={handleCloseDialog}>
                    <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.dialogHeader}>
                            <h3 className={styles.dialogTitle}>Thêm tài sản thẩm định</h3>
                            <button className={styles.dialogCloseButton} onClick={handleCloseDialog}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.dialogBody}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Tỉnh/Thành phố</label>
                                <select className={styles.formSelect} value={province} onChange={handleProvinceChange}>
                                    <option value="">-- Chọn tỉnh/thành phố --</option>
                                    {provinces.map((p) => (
                                        <option key={p.code} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {province && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Quận/Huyện</label>
                                <select className={styles.formSelect} value={district} onChange={handleDistrictChange}>
                                    <option value="">-- Chọn quận/huyện --</option>
                                    {districtOptions.map((d) => (
                                        <option key={d.code} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>)}

                            {district && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Phường/Xã</label>
                                <select className={styles.formSelect} value={ward} onChange={handleWardChange}>
                                    <option value="">-- Chọn phường/xã --</option>
                                    {wardOptions.map((w) => (
                                        <option key={w.code} value={w.name}>{w.name}</option>
                                    ))}
                                </select>
                            </div>)}

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Tên đường</label>
                                <input type="text" className={styles.formInput} value={street} onChange={handleStreetChange} />
                            </div>
                        </div>

                        <div className={styles.dialogFooter}>
                            <button className={styles.cancelButton} onClick={handleCloseDialog}>
                                Hủy
                            </button>
                            <button className={styles.confirmButton} onClick={handleConfirmAdd}>
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AppraisalWorksheet;
