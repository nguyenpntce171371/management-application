import { useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import { Search, Plus, X } from "lucide-react";
import axiosInstance from "../../services/axiosInstance";
import styles from "./ComparisonPropertySelector.module.css";
import provinces from "../../data/vietnam-provinces.json";
import { notify } from "../../context/NotificationContext";

function ComparisonPropertySelector({ appraisal, selectedComparisons, onToggleComparison, allCachedProperties }) {
    const [formData, setFormData] = useState({
        propertyType: "",
        province: "",
        district: "",
        ward: "",
        street: "",
        lat: "",
        lng: ""
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [nearbyProperties, setNearbyProperties] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [hoveredProperty, setHoveredProperty] = useState(null);

    const [showAddDialog, setShowAddDialog] = useState(false);

    const tooltipRefs = useRef({});
    const containerRef = useRef(null);

    const [tooltipAlignment, setTooltipAlignment] = useState("center");

    const selectedProperties = useMemo(() => {
        const ids = selectedComparisons[appraisal.id] || [];

        const mapped = ids.map(id => allCachedProperties.find(p => p.id === id));

        const filtered = mapped.filter(Boolean);

        return filtered;
    }, [selectedComparisons, appraisal.id, allCachedProperties]);

    useLayoutEffect(() => {
        if (hoveredProperty && tooltipRefs.current[hoveredProperty] && containerRef.current) {
            const tooltipRect = tooltipRefs.current[hoveredProperty].getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            let alignment = "center";

            if (tooltipRect.right > containerRect.right - 8) {
                alignment = "right";
            } else if (tooltipRect.left < containerRect.left + 8) {
                alignment = "left";
            }

            setTooltipAlignment(alignment);
        }
    }, [hoveredProperty]);

    const fetchSearch = useCallback(async (search) => {
        const res = await axiosInstance.get("/api/real-estates", {
            params: {
                limit: 50,
                search,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
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
                sortOrder: "desc"
            }
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

        return searchResults.filter(p => !nearbyIds.has(p.id) && !selectedIds.has(p.id));
    }, [searchResults, nearbyProperties, selectedComparisons, appraisal.id]);

    const filteredNearbyProperties = useMemo(() => {
        const selectedIds = new Set(selectedComparisons[appraisal.id] || []);
        const result = nearbyProperties.filter(p => !selectedIds.has(p.id));
        return result;
    }, [nearbyProperties, selectedComparisons, appraisal.id]);


    const displayProperties = useMemo(() => {
        const result = [...selectedProperties, ...filteredNearbyProperties, ...filteredSearchResults];
        return result;
    }, [selectedProperties, filteredNearbyProperties, filteredSearchResults]);


    const handleToggle = useCallback(
        (id) => { onToggleComparison(appraisal.id, id); },
        [appraisal.id, onToggleComparison, selectedComparisons]
    );

    const handleAddEmptyComparison = useCallback(async () => {
        setShowAddDialog(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setShowAddDialog(false);
    }, []);

    const convertAddress = async (address) => {
        const response = await axiosInstance.post("/api/addresses/convert", { address });
        return response.data.data.new;
    };

    const handleConfirmAdd = useCallback(async () => {
        if (!formData.propertyType || !formData.province || !formData.district || !formData.ward || !formData.street) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin"
            });
            return;
        }

        const address = `${formData.ward}, ${formData.district}, ${formData.province}`;
        const newAddress = await convertAddress(address);
        const empty = {
            ...formData,
            location: {
                landParcel: `${address} (nay ${newAddress})`,
                description: `TSTĐ tiếp giáp đường ${formData.street}`,
                lat: formData.lat,
                lng: formData.lng
            }
        };

        const res = await axiosInstance.post("/api/real-estates/comparison", empty);

        handleToggle(res.data.data);

        handleCloseDialog();
    }, [formData, handleCloseDialog]);

    const selectedProvinceData = useMemo(() => (
        provinces.find(p => p.name === formData.province)
    ), [provinces, formData.province]);

    const districtOptions = useMemo(() => (
        selectedProvinceData?.districts || []
    ), [selectedProvinceData]);

    const selectedDistrictData = useMemo(() => (
        districtOptions.find(d => d.name === formData.district)
    ), [districtOptions, formData.district]);

    const wardOptions = useMemo(() => (
        selectedDistrictData?.wards || []
    ), [selectedDistrictData]);

    const handleProvinceChange = useCallback((e) => {
        const value = e.target.value;

        setFormData(prev => ({
            ...prev,
            province: value,
            district: "",
            ward: ""
        }));
    }, []);

    const handleDistrictChange = useCallback((e) => {
        const value = e.target.value;

        setFormData(prev => ({
            ...prev,
            district: value,
            ward: ""
        }));
    }, []);

    const handleWardChange = useCallback((e) => {
        const value = e.target.value;

        setFormData(prev => ({
            ...prev,
            ward: value
        }));
    }, []);

    const handleStreetChange = useCallback((e) => {
        const value = e.target.value;

        setFormData(prev => ({
            ...prev,
            street: value
        }));
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
                {displayProperties.map((property, INDEX) => {
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
                                {property.propertyType || "Không rõ"}
                            </span>

                            {hoveredProperty === property.id && (
                                <div ref={el => (tooltipRefs.current[property.id] = el)} className={`${styles.tooltip} ${tooltipAlignment === "left" ? styles.tooltipLeft : tooltipAlignment === "right" ? styles.tooltipRight : styles.tooltipCenter}`}>
                                    {property.images?.length > 0 && <div className={styles.tooltipRow} style={{ display: "flex", gap: 6 }}>{property.images.slice(0, 5).map((img, index) => <img key={index} src={img} alt={`Property ${index + 1}`} width={50} height={50} style={{ objectFit: "cover", borderRadius: 4 }} />)}</div>}
                                    {(property.location?.landParcel || property.address) && <div className={styles.tooltipRow}><strong>Địa chỉ:</strong> {property.location?.landParcel || property.address}</div>}
                                    {property.width && property.length && <div className={styles.tooltipRow}><strong>Kích thước:</strong>{property.width}x{property.length}</div>}
                                    {property.area && <div className={styles.tooltipRow}><strong>Diện tích:</strong>{property.area}</div>}
                                    {property.usableArea && <div className={styles.tooltipRow}><strong>DT sử dụng:</strong> {property.usableArea}</div>}
                                    {property.price && <div className={styles.tooltipRow}><strong>Giá:</strong> {property.price}</div>}
                                    {property.constructionValue && <div className={styles.tooltipRow}><strong>Giá trị công trình xây dựng:</strong> {property.constructionValue}</div>}
                                    {property.landUseRightUnitPrice && <div className={styles.tooltipRow}><strong>Đơn giá QSDĐ:</strong> {property.landUseRightUnitPrice}</div>}
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
                            <h3 className={styles.dialogTitle}>Thêm tài sản so sánh</h3>
                            <button className={styles.dialogCloseButton} onClick={handleCloseDialog}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.dialogBody}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Loại</label>
                                <input type="text" className={styles.formInput} value={formData.propertyType} onChange={(e) => setFormData(prev => ({ ...prev, propertyType: e.target.value }))} placeholder="Nhà cấp 4, Đất trống, Nhà 1 trệt 2 lầu, ..." />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Tỉnh/Thành phố</label>
                                <select className={styles.formSelect} value={formData.province} onChange={handleProvinceChange}>
                                    <option value="">-- Chọn tỉnh/thành phố --</option>
                                    {provinces.map((p) => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {formData.province && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Quận/Huyện</label>
                                <select className={styles.formSelect} value={formData.district} onChange={handleDistrictChange}>
                                    <option value="">-- Chọn quận/huyện --</option>
                                    {districtOptions.map((d) => (
                                        <option key={d.name} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>)}

                            {formData.district && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Phường/Xã</label>
                                <select className={styles.formSelect} value={formData.ward} onChange={handleWardChange}>
                                    <option value="">-- Chọn phường/xã --</option>
                                    {wardOptions.map((w) => (
                                        <option key={w.name} value={w.name}>{w.name}</option>
                                    ))}
                                </select>
                            </div>)}

                            {formData.ward && (<div className={styles.formGroup}>
                                <label className={styles.formLabel}>Tên đường</label>
                                <input type="text" className={styles.formInput} value={formData.street} onChange={handleStreetChange} />
                            </div>)}

                            {formData.ward && (<div className={styles.formGroup}>
                                <div className={styles.formCoor}>
                                    <div className={styles.formCoorItem}>
                                        <label className={styles.formLabel}>Vĩ độ (lat)</label>
                                        <input type="text" className={styles.formInput} value={formData.lat} onChange={(e) => setFormData(prev => ({ ...prev, lat: e.target.value }))} placeholder="Nếu có. (có thể bỏ qua)" />
                                    </div>
                                    <div className={styles.formCoorItem}>
                                        <label className={styles.formLabel}>Kinh độ (lng)</label>
                                        <input type="text" className={styles.formInput} value={formData.lng} onChange={(e) => setFormData(prev => ({ ...prev, lng: e.target.value }))} placeholder="Nếu có. (có thể bỏ qua)" />
                                    </div>
                                </div>
                            </div>)}
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
