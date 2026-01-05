import { useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import { Search } from "lucide-react";
import axiosInstance from "../../services/axiosInstance";
import styles from "./ComparisonPropertySelector.module.css";

function ComparisonPropertySelector({ appraisal, selectedComparisons, onToggleComparison, allCachedProperties }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [nearbyProperties, setNearbyProperties] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [hoveredProperty, setHoveredProperty] = useState(null);
    const [tooltipAlignment, setTooltipAlignment] = useState({});

    const tooltipRefs = useRef({});
    const containerRef = useRef(null);

    const selectedProperties = useMemo(() => (
        (selectedComparisons[appraisal.id] || []).map(id => allCachedProperties.find(p => p.id === id || p._id === id)).filter(Boolean)
    ), [selectedComparisons, appraisal.id, allCachedProperties]);

    useLayoutEffect(() => {
        if (hoveredProperty && tooltipRefs.current[hoveredProperty] && containerRef.current) {
            const tooltipRect = tooltipRefs.current[hoveredProperty].getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            let alignment = "center";
            if (tooltipRect.right > containerRect.right - 8) alignment = "right";
            else if (tooltipRect.left < containerRect.left + 8) alignment = "left";

            setTooltipAlignment(prev => ({ ...prev, [hoveredProperty]: alignment }));
        }
    }, [hoveredProperty]);

    const fetchSearch = useCallback(async (search) => {
        const res = await axiosInstance.get("/api/real-estate", {
            params: {
                page: 1,
                limit: 50,
                search,
                sortBy: "createdAt",
                sortOrder: "desc",
            },
        });
        const data = res.data?.data ?? [];
        setSearchResults(data.map(p => ({ ...p, id: p._id })));
    }, []);

    const fetchNearby = useCallback(async () => {
        if (!appraisal) return [];
        const res = await axiosInstance.get("/api/real-estate/nearby", {
            params: {
                province: appraisal.province,
                district: appraisal.district,
                ward: appraisal.ward,
                street: appraisal.street,
                limit: 20,
            },
        });
        return (res.data?.data ?? []).map(p => ({ ...p, id: p._id }));
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
            window.open(`/user/real-estate/${propertyId}`, "_blank", "noopener,noreferrer");
        }
    }, []);

    const filteredSearchResults = useMemo(() => {
        const nearbyIds = new Set(nearbyProperties.map(p => p.id));
        const selectedIds = new Set(selectedComparisons[appraisal.id] || []);

        return searchResults.filter(
            p => !nearbyIds.has(p.id) && !selectedIds.has(p.id)
        );
    }, [searchResults, nearbyProperties, selectedComparisons, appraisal.id]);

    const displayProperties = useMemo(
        () => [...selectedProperties, ...nearbyProperties, ...filteredSearchResults],
        [selectedProperties, nearbyProperties, filteredSearchResults]
    );

    const handleToggle = useCallback(
        (propertyId) => onToggleComparison(appraisal.id, propertyId),
        [appraisal.id, onToggleComparison]
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>
                    Tài sản so sánh cho {appraisal.name || "Chưa xác định"}
                </span>
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
            </div>

            <div ref={containerRef} className={styles.propertiesList}>
                {displayProperties.map(property => {
                    const isSelected = (selectedComparisons[appraisal.id] || []).includes(property.id);
                    const selectionIndex = isSelected ? selectedComparisons[appraisal.id].indexOf(property.id) + 1 : null;
                    const alignment = tooltipAlignment[property.id] || "center";

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
                                <div ref={el => (tooltipRefs.current[property.id] = el)} className={`${styles.tooltip} ${styles[`tooltip${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`]}`}>
                                    <div className={styles.tooltipRow}><strong>Loại:</strong> {property.propertyType || "Không rõ loại"}</div>
                                    <div className={styles.tooltipRow}><strong>Địa chỉ:</strong> {property.location?.landParcel || property.address || "Không có địa chỉ"}</div>
                                    <div className={styles.tooltipRow}><strong>Diện tích:</strong> {property.area || "N/A"}</div>
                                    <div className={styles.tooltipRow}><strong>DT sử dụng:</strong> {property.usableArea || "N/A"}</div>
                                    <div className={styles.tooltipRow}><strong>Giá:</strong> {property.price || "N/A"}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ComparisonPropertySelector;
