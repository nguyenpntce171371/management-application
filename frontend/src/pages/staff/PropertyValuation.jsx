import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";
import { Search, Trash2, Plus } from "lucide-react";
import styles from "./PropertyValuation.module.css";
import { useSocket } from "../../context/SocketContext";
import { useNavigate, useSearchParams } from "react-router-dom";

const statusConfig = {
    draft: { label: "Nháp", className: styles.statusDraft },
    pending: { label: "Chờ xử lý", className: styles.statusPending },
    "in-progress": { label: "Đang thẩm định", className: styles.statusInProgress },
    completed: { label: "Hoàn thành", className: styles.statusCompleted },
    rejected: { label: "Từ chối", className: styles.statusRejected },
};

function PropertyValuation() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pageFromUrl = parseInt(searchParams.get("page") || "1");
    const searchFromUrl = searchParams.get("search") || "";
    const [page, setPage] = useState(pageFromUrl);
    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
    const [appraisals, setAppraisals] = useState([]);
    const socket = useSocket();
    const debounceTimers = useRef({})
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setPage(pageFromUrl);
        setSearchTerm(searchFromUrl);
        setDebouncedSearch(searchFromUrl);
    }, [pageFromUrl, searchFromUrl]);

    const fetchAppraisals = useCallback(async () => {
        const res = await axiosInstance.get("/api/staff/appraisals", {
            params: {
                page,
                limit,
                search: debouncedSearch,
            },
        });

        setAppraisals(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
    }, [page, limit, debouncedSearch]);

    useEffect(() => {
        fetchAppraisals();
    }, [fetchAppraisals]);

    useEffect(() => {
        if (!socket) return;

        const onUpdated = (updated) => {
            setAppraisals(prev =>
                prev.map(a => a._id === updated._id ? updated : a)
            );
        };

        socket.on("appraisalCreated", fetchAppraisals);
        socket.on("appraisalUpdated", onUpdated);
        socket.on("appraisalDeleted", fetchAppraisals);

        return () => {
            socket.off("appraisalCreated", fetchAppraisals);
            socket.off("appraisalUpdated", onUpdated);
            socket.off("appraisalDeleted", fetchAppraisals);
        };
    }, [socket, page, debouncedSearch, limit]);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            updateParams({ search: searchTerm, page: 1 });
        }, 400);

        return () => clearTimeout(t);
    }, [searchTerm]);

    const handleChange = useCallback((id, field, value) => {
        setAppraisals(prev =>
            prev.map(a => a._id === id ? { ...a, [field]: value } : a)
        );

        if (!socket) return;

        const timerKey = `${id}-${field}`;
        if (debounceTimers.current[timerKey]) {
            clearTimeout(debounceTimers.current[timerKey]);
        }

        debounceTimers.current[timerKey] = setTimeout(() => {
            socket.emit("appraisal:update", { id, field, value });
            delete debounceTimers.current[timerKey];
        }, 500);
    }, [socket]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const handleCreate = async () => {
        await axiosInstance.post("/api/staff/appraisals", {
            customerName: "",
            propertyType: ""
        });
    };

    const handleDelete = async (id) => {
        const appraisal = appraisals.find(a => a._id === id);
        if (!appraisal) return;
        if (!window.confirm(`Xác nhận xóa hồ sơ ${appraisal.code}?`)) return;
        setAppraisals(prev => prev.filter(a => a._id !== id));
        await axiosInstance.delete(`/api/staff/appraisals/${id}`);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateParams({ page: newPage });
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerTop}>
                    <div className={styles.headerLeft}>
                        <div className={styles.titleWrapper}>
                            <h1 className={styles.title}>Quản lý thẩm định giá</h1>
                            <p className={styles.subtitle}>Theo dõi và quản lý tất cả hồ sơ thẩm định bất động sản</p>
                        </div>
                    </div>
                    <div className={styles.searchBox}>
                        <Search className={styles.searchIcon} size={18} />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={styles.searchInput} />
                    </div>
                    <button className={styles.addButton} onClick={handleCreate}>
                        <Plus size={20} strokeWidth={2.5} />
                        <span>Tạo hồ sơ mới</span>
                    </button>
                </div>
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
                            {appraisals.map((appraisal) => (
                                <tr key={appraisal._id} className={styles.row}>
                                    <td className={styles.codeCell}>
                                        <Link to={`/staff/property-valuation/${appraisal._id}`} className={styles.code}>{appraisal.code}</Link>
                                    </td>
                                    <td>
                                        <input value={appraisal.customerName || ""} onChange={(e) => handleChange(appraisal._id, "customerName", e.target.value)} className={styles.tableInput} />
                                    </td>
                                    <td>
                                        <input value={appraisal.appraiser || ""} onChange={(e) => handleChange(appraisal._id, "appraiser", e.target.value)} className={styles.tableInput} />
                                    </td>
                                    <td className={styles.dateCell}>
                                        <input type="date" value={appraisal.createdDate ? appraisal.createdDate.slice(0, 10) : ""} onChange={(e) => handleChange(appraisal._id, "createdDate", e.target.value)} className={styles.dateInput} />
                                    </td>
                                    <td className={styles.dateCell}>
                                        <input type="date" value={appraisal.completedDate ? appraisal.completedDate.slice(0, 10) : ""} onChange={(e) => handleChange(appraisal._id, "completedDate", e.target.value)} className={styles.dateInput} />
                                    </td>
                                    <td>
                                        <select value={appraisal.status} onChange={(e) => handleChange(appraisal._id, "status", e.target.value)} className={`${styles.statusSelect} ${statusConfig[appraisal.status]?.className}`}>
                                            <option value="draft">Nháp</option>
                                            <option value="pending">Chờ xử lý</option>
                                            <option value="in-progress">Đang thẩm định</option>
                                            <option value="completed">Hoàn thành</option>
                                            <option value="rejected">Từ chối</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input value={appraisal.notes || ""} onChange={(e) => handleChange(appraisal._id, "notes", e.target.value)} className={styles.tableInput} />
                                    </td>
                                    <td className={styles.actionsCell}>
                                        <button onClick={() => handleDelete(appraisal._id)} className={styles.deleteButton} title="Xóa hồ sơ" aria-label="Xóa" >
                                            <Trash2 size={16} strokeWidth={2} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
    );
}

export default PropertyValuation;
