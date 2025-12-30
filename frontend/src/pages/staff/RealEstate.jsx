import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./RealEstate.module.css";
import PageHeader from "../../components/layout/PageHeader";
import PropertyCard from "../../components/property/PropertyCard";
import axiosInstance from "../../services/axiosInstance";
import { REAL_ESTATE_TYPES, REAL_ESTATE_LOCATIONS, REAL_ESTATE_STATUSES } from "../../config/realEstate";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlusCircle, Search, SlidersHorizontal, Grid3x3, List, MapPin, TrendingUp, X, Filter } from "lucide-react";

function RealEstate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pageFromUrl = parseInt(searchParams.get("page") || "1");
    const searchFromUrl = searchParams.get("search") || "";
    const typeFromUrl = searchParams.get("type") || "all";
    const locationFromUrl = searchParams.get("location") || "all";
    const statusFromUrl = searchParams.get("status") || "all";
    const [page, setPage] = useState(pageFromUrl);
    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchFromUrl);
    const [selectedType, setSelectedType] = useState(typeFromUrl);
    const [selectedLocation, setSelectedLocation] = useState(locationFromUrl);
    const [selectedStatus, setSelectedStatus] = useState(statusFromUrl);
    const [viewMode, setViewMode] = useState("grid");
    const [showFilters, setShowFilters] = useState(false);
    const [properties, setProperties] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    useEffect(() => {
        setPage(pageFromUrl);
        setSearchTerm(searchFromUrl);
        setDebouncedSearchTerm(searchFromUrl);
        setSelectedType(typeFromUrl);
        setSelectedLocation(locationFromUrl);
        setSelectedStatus(statusFromUrl);
    }, [pageFromUrl, searchFromUrl, typeFromUrl, locationFromUrl, statusFromUrl]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            updateParams({ search: searchTerm, page: 1 });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchData = useCallback(async () => {
        const res = await axiosInstance.get("/api/real-estate", {
            params: {
                page,
                limit: 21,
                search: debouncedSearchTerm,
                type: selectedType,
                location: selectedLocation,
                status: selectedStatus,
                sortBy: "createdAt",
                sortOrder: "desc",
            },
        });
        const newData = res.data?.data ?? [];
        const pagination = res.data?.pagination;
        setProperties(newData);
        setTotalPages(pagination?.totalPages || 1);
        setTotalItems(pagination?.total || 0);
    }, [page, debouncedSearchTerm, selectedType, selectedLocation, selectedStatus]);

    useEffect(() => {
        fetchData();
    }, [page, debouncedSearchTerm, selectedType, selectedLocation, selectedStatus]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateParams({ page: newPage });
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const clearFilters = () => {
        navigate("?page=1");
    };

    const activeFiltersCount = (selectedType !== "all" ? 1 : 0) + (selectedLocation !== "all" ? 1 : 0) + (selectedStatus !== "all" ? 1 : 0);

    return (
        <>
            <PageHeader title="Danh Sách Bất Động Sản" />
            <div className={styles.content}>
                <div className={styles.searchFilterBar}>
                    <div className={styles.searchSection}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} />
                            <input type="text" placeholder="Tìm kiếm theo tên hoặc địa điểm..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`} onClick={() => setShowFilters(!showFilters)}>
                            <SlidersHorizontal />
                            Lọc
                            {activeFiltersCount > 0 && (<span className={styles.filterBadge}>{activeFiltersCount}</span>)}
                        </button>
                    </div>
                    <div className={styles.viewControls}>
                        <div className={styles.viewModeButtons}>
                            <button className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("grid")}><Grid3x3 /></button>
                            <button className={`${styles.viewModeBtn} ${viewMode === "list" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("list")}><List /></button>
                        </div>
                        <Link className={styles.addButton} to="/user/add-real-estate">
                            <PlusCircle />Đăng bán BĐS mới
                        </Link>
                    </div>
                </div>
                {showFilters && (
                    <div className={styles.advancedFilters}>
                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>
                                <Filter className={styles.filterIcon} />
                                Loại hình
                            </label>
                            <select className={styles.filterSelect} value={selectedType} onChange={(e) => updateParams({ type: e.target.value, page: 1 })}>
                                <option value="all">Tất cả</option>
                                {REAL_ESTATE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>
                                <MapPin className={styles.filterIcon} />
                                Khu vực
                            </label>
                            <select className={styles.filterSelect} value={selectedLocation} onChange={(e) => updateParams({ location: e.target.value, page: 1 })}>
                                <option value="all">Tất cả</option>
                                {REAL_ESTATE_LOCATIONS.map(location => (
                                    <option key={location} value={location}>{location}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>
                                <TrendingUp className={styles.filterIcon} />
                                Trạng thái
                            </label>
                            <select className={styles.filterSelect} value={selectedStatus} onChange={(e) => updateParams({ status: e.target.value, page: 1 })}>
                                <option value="all">Tất cả</option>
                                {REAL_ESTATE_STATUSES.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>

                        <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                            <X />
                            Xóa bộ lọc
                        </button>
                    </div>
                )}

                <div className={styles.resultsInfo}>
                    <p>Hiển thị {properties.length} / {totalItems} bất động sản</p>
                </div>

                <div className={viewMode === "grid" ? styles.propertiesGrid : styles.propertiesList}>
                    {properties.map((property) => (
                        <PropertyCard key={property._id} viewMode={viewMode} property={property} detailLink={`/staff/real-estate/${property._id}`} onDelete={true} />
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className={styles.paginationContainer}>
                        <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className={styles.pageNavButton}>
                            Trước
                        </button>

                        <div className={styles.pageNumbers}>
                            {(() => {
                                const pages = [];
                                const maxVisible = 5;
                                let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
                                let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                                if (endPage - startPage < maxVisible - 1) {
                                    startPage = Math.max(1, endPage - maxVisible + 1);
                                }
                                if (startPage > 1) {
                                    pages.push(<button key={1} onClick={() => handlePageChange(1)} className={styles.pageButton}>1</button>);
                                    if (startPage > 2)
                                        pages.push(<span key="dots1" className={styles.pageDots}>...</span>);
                                }
                                for (let i = startPage; i <= endPage; i++) {
                                    pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`${styles.pageButton} ${i === page ? styles.pageButtonActive : ""}`}>{i}</button>);
                                }

                                if (endPage < totalPages) {
                                    if (endPage < totalPages - 1)
                                        pages.push(<span key="dots2" className={styles.pageDots}>...</span>);
                                    pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className={styles.pageButton}>{totalPages}</button>);
                                }

                                return pages;
                            })()}
                        </div>

                        <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className={styles.pageNavButton}>
                            Sau
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default RealEstate;