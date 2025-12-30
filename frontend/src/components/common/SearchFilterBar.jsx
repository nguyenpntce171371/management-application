import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./SearchFilterBar.module.css";
import { PlusCircle, Search, SlidersHorizontal, Grid3x3, List, MapPin, TrendingUp, X, Filter } from "lucide-react";

function SearchFilterBar({ searchTerm, setSearchTerm, viewMode, setViewMode, selectedType, setSelectedType, selectedLocation, setSelectedLocation, selectedStatus, setSelectedStatus, clearFilters, types, locations, statuses }) {
    const [showFilters, setShowFilters] = useState(false);

    const activeFiltersCount = (selectedType !== "all" ? 1 : 0) + (selectedLocation !== "all" ? 1 : 0) + (selectedStatus !== "all" ? 1 : 0);

    return (
        <>
            <div className={styles.searchFilterBar}>
                <div className={styles.searchSection}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} />
                        <input type="text" placeholder="Tìm kiếm theo tên hoặc địa điểm..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        {searchTerm && (
                            <button className={styles.clearSearch} onClick={() => setSearchTerm("")}>
                                <X />
                            </button>
                        )}
                    </div>

                    <button className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`} onClick={() => setShowFilters(!showFilters)}>
                        <SlidersHorizontal />
                        Lọc
                        {activeFiltersCount > 0 && (<span className={styles.filterBadge}>{activeFiltersCount}</span>)}
                    </button>
                </div>

                <div className={styles.viewControls}>
                    <div className={styles.viewModeButtons}>
                        <button className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("grid")}>
                            <Grid3x3 />
                        </button>
                        <button className={`${styles.viewModeBtn} ${viewMode === "list" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("list")}>
                            <List />
                        </button>
                    </div>

                    <Link className={styles.addButton} to="/user/add-real-estate">
                        <PlusCircle />
                        Thêm BĐS
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
                        <select className={styles.filterSelect} value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                            <option value="all">Tất cả</option>
                            {types.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>
                            <MapPin className={styles.filterIcon} />
                            Khu vực
                        </label>
                        <select className={styles.filterSelect} value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} >
                            <option value="all">Tất cả</option>
                            {locations.map(location => (
                                <option key={location} value={location}>{location}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>
                            <TrendingUp className={styles.filterIcon} />
                            Trạng thái
                        </label>
                        <select className={styles.filterSelect} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} >
                            <option value="all">Tất cả</option>
                            {statuses.map(status => (
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
        </>
    )
}

export default SearchFilterBar;