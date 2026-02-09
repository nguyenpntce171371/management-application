import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { RotateCcw, Trash2 } from "lucide-react";
import styles from "../DeletedItemsManagement.module.css";
import { useSocket } from "../../../context/SocketContext";
import axiosInstance from "../../../services/axiosInstance";
import SearchField from "../../../components/common/SearchField";
import Pagination from "../../../components/common/Pagination";

function DeletedRealEstates() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const socket = useSocket();

    const searchFromUrl = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [direction, setDirection] = useState("next");
    const [nextCursor, setNextCursor] = useState(null);
    const [prevCursor, setPrevCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const limit = 21;

    const [restoring, setRestoring] = useState(null);
    const [deleting, setDeleting] = useState(null);

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
        const res = await axiosInstance.get("/api/real-estates/deleted", {
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

        socket.on("realEstateDeleted", refresh);
        socket.on("realEstateRestored", refresh);
        socket.on("realEstatePermanentlyDeleted", refresh);

        return () => {
            socket.off("realEstateDeleted", refresh);
            socket.off("realEstateRestored", refresh);
            socket.off("realEstatePermanentlyDeleted", refresh);
        };
    }, [socket, fetchData]);

    const handleRestore = async (id) => {
        setRestoring(id);
        try {
            await axiosInstance.post(`/api/real-estates/restore/${id}`);
            fetchData();
        } finally {
            setRestoring(null);
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!confirm("XÓA VĨNH VIỄN - Không thể hoàn tác!\n\nBạn có chắc chắn muốn xóa vĩnh viễn?")) {
            return;
        }

        setDeleting(id);
        try {
            await axiosInstance.delete(`/api/real-estates/deleted/${id}`);
            fetchData();
        } finally {
            setDeleting(null);
        }
    };

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    return (
        <>
            <div className={styles.searchWrapper}>
                <SearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Tìm kiếm theo tên hoặc địa điểm..." />
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Loại BĐS</th>
                            <th>Địa Chỉ</th>
                            <th>Giá</th>
                            <th>Ngày Xóa</th>
                            <th>Xóa Bởi</th>
                            <th>Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(items ?? []).map((item) => (
                            <tr key={item.id}>
                                <td>{item.propertyType}</td>
                                <td>{item.address}</td>
                                <td>{item.price}</td>
                                <td>{new Date(item.deletedAt).toLocaleString("vi-VN")}</td>
                                <td>{item.deletedBy?.fullName || "System"}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button className={styles.btnRestore} onClick={() => handleRestore(item.id)} disabled={restoring === item.id} title="Khôi phục"                                        >
                                            <RotateCcw size={16} />
                                        </button>

                                        <button className={styles.btnDelete} onClick={() => handlePermanentDelete(item.id)} disabled={deleting === item.id} title="Xóa vĩnh viễn">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
        </>
    );
}

export default DeletedRealEstates;