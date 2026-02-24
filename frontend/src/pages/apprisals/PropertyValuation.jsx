import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";
import { Trash2, Plus } from "lucide-react";
import styles from "./PropertyValuation.module.css";
import { useSocket } from "../../context/SocketContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import SearchField from "../../components/common/SearchField";
import Pagination from "../../components/common/Pagination";

function PropertyValuation() {
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

    const debounceTimers = useRef({});

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
        const res = await axiosInstance.get("/api/appraisals", {
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

        socket.on("appraisalCreated", refresh);
        socket.on("appraisalRestored", refresh);
        socket.on("appraisalDeleted", refresh);
        socket.on("appraisalUpdated", refresh);

        return () => {
            socket.off("appraisalCreated", refresh);
            socket.off("appraisalRestored", refresh);
            socket.off("appraisalDeleted", refresh);
            socket.off("appraisalUpdated", refresh);
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

    const handleChange = useCallback((id, field, value) => {
        setItems((appraisal) =>
            appraisal.map(a => a.id === id ? { ...a, [field]: value } : a)
        );

        const timerKey = `${id}-${field}`;
        if (debounceTimers.current[timerKey]) {
            clearTimeout(debounceTimers.current[timerKey]);
        }

        debounceTimers.current[timerKey] = setTimeout(async () => {
            await axiosInstance.post(`/api/appraisals/${id}`, { [field]: value });
            delete debounceTimers.current[timerKey];
        }, 500);
    }, []);

    const handleCreate = async () => {
        await axiosInstance.post("/api/appraisals");
    };

    const handleDelete = async (id) => {
        await axiosInstance.delete(`/api/appraisals/${id}`);
    };

    return (
        <>
            <PageHeader title="Quản lý thẩm định giá" />
            <div className={styles.content}>
                <div className={styles.searchBar}>
                    <div className={styles.searchWrapper}>
                        <SearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Tìm kiếm theo mã hồ sơ, khách hàng hoặc thẩm định viên ..." />
                    </div>
                    <button className={styles.addButton} onClick={handleCreate}>
                        <Plus size={20} strokeWidth={2.5} />
                        <span>Tạo hồ sơ mới</span>
                    </button>
                </div>

                <div className={styles.tableContainer}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.thCode}>
                                        <div className={styles.thContent}>
                                            <span>Mã hồ sơ</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Khách hàng</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Thẩm định viên</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Ngày tạo</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Hoàn thành</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Trạng thái</span>
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            <span>Ghi chú</span>
                                        </div>
                                    </th>
                                    <th className={styles.thActions}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(items || []).map((appraisal) => (
                                    <tr key={appraisal.id} className={styles.row}>
                                        <td className={styles.codeCell}>
                                            <Link to={`/appraisals/${appraisal.id}`} className={styles.code}>{appraisal.code}</Link>
                                        </td>
                                        <td>
                                            <input value={appraisal.customerName || ""} onChange={(e) => handleChange(appraisal.id, "customerName", e.target.value)} className={styles.tableInput} />
                                        </td>
                                        <td>
                                            <input value={appraisal.appraiser || ""} onChange={(e) => handleChange(appraisal.id, "appraiser", e.target.value)} className={styles.tableInput} />
                                        </td>
                                        <td className={styles.dateCell}>
                                            <input type="date" value={appraisal.createdAt ? appraisal.createdAt.slice(0, 10) : ""} onChange={(e) => handleChange(appraisal.id, "createdAt", e.target.value)} className={styles.dateInput} />
                                        </td>
                                        <td className={styles.dateCell}>
                                            <input type="date" value={appraisal.completedAt ? appraisal.completedAt.slice(0, 10) : ""} onChange={(e) => handleChange(appraisal.id, "completedAt", e.target.value)} className={styles.dateInput} />
                                        </td>
                                        <td>
                                            <select value={appraisal.status} onChange={(e) => handleChange(appraisal.id, "status", e.target.value)} className={styles.statusSelect}>
                                                <option className={styles.option} value="draft">Nháp</option>
                                                <option className={styles.option} value="pending">Chờ xử lý</option>
                                                <option className={styles.option} value="in-progress">Đang thẩm định</option>
                                                <option className={styles.option} value="completed">Hoàn thành</option>
                                                <option className={styles.option} value="rejected">Từ chối</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input value={appraisal.notes || ""} onChange={(e) => handleChange(appraisal.id, "notes", e.target.value)} className={styles.tableInput} />
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button onClick={() => handleDelete(appraisal.id)} className={styles.deleteButton} title="Xóa hồ sơ" aria-label="Xóa" >
                                                <Trash2 size={16} strokeWidth={2} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
                </div>
            </div>
        </>
    );
}

export default PropertyValuation;
