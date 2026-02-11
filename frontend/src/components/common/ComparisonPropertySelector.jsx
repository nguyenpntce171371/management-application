import { useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import { Search, Plus, X } from "lucide-react";
import axiosInstance from "../../services/axiosInstance";
import styles from "./ComparisonPropertySelector.module.css";
import provinces from "../../data/vietnam-provinces.json";
import { notify } from "../../context/NotificationContext";

function ComparisonPropertySelector({ appraisal, selectedComparisons, onToggleComparison, allCachedProperties }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [nearbyProperties, setNearbyProperties] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [hoveredProperty, setHoveredProperty] = useState(null);

    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [ward, setWard] = useState("");
    const [street, setStreet] = useState("");

    const [showAddDialog, setShowAddDialog] = useState(false);

    const tooltipRefs = useRef({});
    const containerRef = useRef(null);

    const selectedProperties = useMemo(() => (
        (selectedComparisons[appraisal.id] || []).map(id => allCachedProperties.find(p => p.id === id)).filter(Boolean)
    ), [selectedComparisons, appraisal.id, allCachedProperties]);

    useLayoutEffect(() => {
        if (hoveredProperty && tooltipRefs.current[hoveredProperty] && containerRef.current) {
            const tooltipRect = tooltipRefs.current[hoveredProperty].getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            let alignment = "center";
            if (tooltipRect.right > containerRect.right - 8) alignment = "right";
            else if (tooltipRect.left < containerRect.left + 8) alignment = "left";
        }
    }, [hoveredProperty]);

    const fetchSearch = useCallback(async (search) => {
        const res = await axiosInstance.get("/api/real-estates", {
            params: {
                limit: 50,
                search,
                sortBy: "createdAt",
                sortOrder: "desc",
            },
        });
        setSearchResults(res.data?.data ?? []);
    }, []);

    const fetchNearby = useCallback(async () => {
        if (!appraisal) return [];
        const res = await axiosInstance.get("/api/real-estates/nearby", {
            params: {
                province: appraisal.province,
                district: appraisal.district,
                ward: appraisal.ward,
                street: appraisal.street,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc",
            },
        });
        return res.data?.data ?? [];
    }, [appraisal]);

    useEffect(() => {
        if (!appraisal?.id) return;

        (async () => {
            const data = await fetchNearby();
            setNearbyProperties(data);
        })();

        setSearchTerm("");
        setSearchResults([]);
    }, [appraisal?.id, fetchNearby]);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            fetchSearch(searchTerm.trim());
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm, fetchSearch]);

    const handleMouseDown = useCallback((e, propertyId) => {
        if (e.button === 1) {
            e.preventDefault();
            window.open(`/real-estates/${propertyId}`, "_blank", "noopener,noreferrer");
        }
    }, []);

    const filteredSearchResults = useMemo(() => {
        const nearbyIds = new Set(nearbyProperties.map(p => p.id));
        const selectedIds = new Set(selectedComparisons[appraisal.id] || []);

        return searchResults.filter(
            p => !nearbyIds.has(p.id) && !selectedIds.has(p.id)
        );
    }, [searchResults, nearbyProperties, selectedComparisons, appraisal.id]);

    const filteredNearbyProperties = useMemo(() => {
        const selectedIds = new Set(selectedComparisons[appraisal.id] || []);
        return nearbyProperties.filter(p => !selectedIds.has(p.id));
    }, [nearbyProperties, selectedComparisons, appraisal.id]);

    const displayProperties = useMemo(
        () => [...selectedProperties, ...filteredNearbyProperties, ...filteredSearchResults],
        [selectedProperties, filteredNearbyProperties, filteredSearchResults]
    );

    const handleToggle = useCallback(
        (id) => onToggleComparison(appraisal.id, id),
        [appraisal.id, onToggleComparison]
    );

    const handleAddEmptyComparison = useCallback(async () => {
        setShowAddDialog(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setShowAddDialog(false);
    }, []);

    const convertAddress = async (address) => {
        try {
            const response = await axiosInstance.post("/api/addresses/convert", { address });
            return response.data.data.new;
        } finally {
            return address;
        }
    };

    const handleConfirmAdd = useCallback(async () => {
        if (!province || !district || !ward || !street) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin",
            });
            return;
        }

        const address = `${ward}, ${district}, ${province}`;
        const newAddress = await convertAddress(address);
        const empty = {
            province: province,
            district: district,
            ward: ward,
            street: street,
            location: {
                landParcel: `${address} (nay ${newAddress})`,
                description: `TSTĐ tiếp giáp đường ${street}`
            }
        };

        const res = await axiosInstance.post("/api/real-estates/comparison", empty);

        handleToggle(res.data.data);

        handleCloseDialog();
    }, [province, district, ward, street, handleCloseDialog]);

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
                <span className={styles.title}>
                    Tài sản so sánh cho {appraisal.name || "Chưa xác định"}
                </span>
                <div className={styles.searchWrapper}>
                    <div className={styles.searchBox}>
                        <Search className={styles.searchIcon} size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                            placeholder="Tìm kiếm tài sản..."
                        />
                    </div>
                    <button className={styles.button} onClick={handleAddEmptyComparison} title="Thêm tài sản so sánh">
                        <Plus size={20} />
                        <span>Thêm TSSS</span>
                    </button>
                </div>
            </div>

            <div ref={containerRef} className={styles.propertiesList}>
                {displayProperties.map(property => {
                    const isSelected = (selectedComparisons[appraisal.id] || []).includes(property.id);
                    const selectionIndex = isSelected ? selectedComparisons[appraisal.id].indexOf(property.id) + 1 : null;

                    return (
                        <div
                            key={property.id}
                            className={`${styles.propertyChip} ${isSelected ? styles.selected : ""} ${(property?.location?.lat != null && property?.location?.lng != null) ? styles.realProperty : ""}`}
                            title={isSelected ? "Click để bỏ chọn" : "Click để chọn"}
                            onClick={() => handleToggle(property.id)}
                            onMouseDown={(e) => handleMouseDown(e, property.id)}
                            onMouseEnter={() => setHoveredProperty(property.id)}
                            onMouseLeave={() => setHoveredProperty(null)}
                        >
                            {isSelected && (
                                <span className={styles.selectionBadge}>{selectionIndex}</span>
                            )}
                            <span className={styles.propertyName}>
                                {property.propertyType || property.name || "Không rõ"}
                            </span>

                            {hoveredProperty === property.id && (
                                <div ref={el => (tooltipRefs.current[property.id] = el)} className={`${styles.tooltip} ${styles.tooltipCenter}`}>
                                    {property.propertyType && <div className={styles.tooltipRow}><strong>Loại:</strong>{property.propertyType}</div>}
                                    {(property.location?.landParcel || property.address) && <div className={styles.tooltipRow}><strong>Địa chỉ:</strong> {property.location?.landParcel || property.address}</div>}
                                    {property.area && <div className={styles.tooltipRow}><strong>Diện tích:</strong>{property.area}</div>}
                                    {property.usableArea && <div className={styles.tooltipRow}><strong>DT sử dụng:</strong> {property.usableArea}</div>}
                                    {property.price && <div className={styles.tooltipRow}><strong>Giá:</strong> {property.price}</div>}
                                </div>
                            )}
                        </div>
                    );
                })}
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
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {province && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Quận/Huyện</label>
                                <select className={styles.formSelect} value={district} onChange={handleDistrictChange}>
                                    <option value="">-- Chọn quận/huyện --</option>
                                    {districtOptions.map((d) => (
                                        <option key={d.name} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>)}

                            {district && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Phường/Xã</label>
                                <select className={styles.formSelect} value={ward} onChange={handleWardChange}>
                                    <option value="">-- Chọn phường/xã --</option>
                                    {wardOptions.map((w) => (
                                        <option key={w.name} value={w.name}>{w.name}</option>
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

export default ComparisonPropertySelector;
