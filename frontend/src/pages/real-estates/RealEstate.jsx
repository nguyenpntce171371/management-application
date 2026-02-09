import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import styles from "./RealEstate.module.css";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";
import { PlusCircle, Grid3x3, List, Check, Eye, MapPin } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import SearchField from "../../components/common/SearchField";
import Pagination from "../../components/common/Pagination";
import { Role } from "../../config/role";
import { useAuth } from "../../context/AuthContext";

function RealEstate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const socket = useSocket();

    const searchFromUrl = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
    const [viewMode, setViewMode] = useState("grid");

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [direction, setDirection] = useState("next");
    const [nextCursor, setNextCursor] = useState(null);
    const [prevCursor, setPrevCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const limit = 21;

    const { user } = useAuth();

    useEffect(() => {
        setSearchTerm(searchFromUrl);
        setDebouncedSearch(searchFromUrl);
    }, [searchFromUrl]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            updateParams({ search: searchTerm });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCursor(null);
        setDirection("next");
    }, [debouncedSearch]);

    const fetchData = useCallback(async () => {
        const res = await axiosInstance.get("/api/real-estates", {
            params: {
                limit,
                cursor,
                direction,
                search: debouncedSearch
            }
        });
        const { data, pagination } = res.data;
        setItems(data || []);
        setHasMore(!!pagination?.hasMore);
        setHasPrev(!!pagination?.hasPrev);
        setNextCursor(pagination?.nextCursor || null);
        setPrevCursor(pagination?.prevCursor || null);
    }, [limit, cursor, direction, debouncedSearch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;

        const refresh = () => fetchData();

        socket.on("realEstateCreated", refresh);
        socket.on("realEstateRestored", refresh);
        socket.on("realEstateDeleted", refresh);
        socket.on("realEstateUpdated", refresh);

        return () => {
            socket.off("realEstateCreated", refresh);
            socket.off("realEstateRestored", refresh);
            socket.off("realEstateDeleted", refresh);
            socket.off("realEstateUpdated", refresh);
        };
    }, [socket, fetchData]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const formatPrice = (price) => {
        if (price >= 1_000_000_000) {
            return (price / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + " tỷ";
        }
        if (price >= 1_000_000) {
            return (price / 1_000_000).toFixed(2).replace(/\.00$/, "") + " triệu";
        }
        return price.toLocaleString("vi-VN");
    };

    const handleApprove = async (property) => {
        await axiosInstance.post(`/api/real-estates/${property.id}`, property);
    }

    return (
        <>
            <PageHeader title="Danh Sách Bất Động Sản" />
            <div className={styles.content}>
                <div className={styles.searchFilterBar}>
                    <SearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Tìm kiếm theo tên hoặc địa điểm..." />
                    <div className={styles.viewControls}>
                        <div className={styles.viewModeButtons}>
                            <button className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("grid")}><Grid3x3 /></button>
                            <button className={`${styles.viewModeBtn} ${viewMode === "list" ? styles.viewModeBtnActive : ""}`} onClick={() => setViewMode("list")}><List /></button>
                        </div>
                        <Link className={styles.addButton} to="/real-estates/add">
                            <PlusCircle />Đăng bán BĐS mới
                        </Link>
                    </div>
                </div>

                <div className={viewMode === "grid" ? styles.propertiesGrid : styles.propertiesList}>
                    {(items ?? []).map((property) => (
                        <div className={`${viewMode === "list" ? styles.propertyCardList : styles.propertyCard}`}>
                            <div className={styles.propertyImage}>
                                <img src={property.images?.[0]} alt={property.title} />
                                <span className={styles.propertyStatus}>
                                    {property.status}
                                </span>
                            </div>
                            <div className={styles.propertyContent}>
                                <h3 className={styles.propertyName}>{property.propertyType}</h3>

                                <div className={styles.propertyLocation}>
                                    <MapPin className={styles.locationIcon} />
                                    <span>{property.address}</span>
                                </div>

                                <div className={styles.propertyFooter}>
                                    <div className={styles.propertyPrice}>
                                        <span className={styles.priceLabel}>Giá bán</span>
                                        <span className={styles.priceValue}>{property.price ? formatPrice(property.price) : "Thương lượng"}</span>
                                    </div>
                                    <div className={styles.propertyActions}>
                                        {(Role[(user.role || "").toUpperCase()].value >= Role["STAFF"].value && property.status === "Chờ duyệt") && (<button className={`${styles.actionBtn} ${styles.actionBtnApprove}`} onClick={() => handleApprove(property, "Đang bán")} title="Duyệt">
                                            <Check className={styles.actionBtnIcon} />
                                        </button>)}
                                        <Link to={`/real-estates/${property.id}`} className={styles.actionBtn}>
                                            <Eye className={styles.actionBtnIcon} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
        </>
    );
}

export default RealEstate;