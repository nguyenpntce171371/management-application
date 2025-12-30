import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import axiosInstance from "../../services/axiosInstance";
import { Search, Trash2, Plus, FileText } from "lucide-react";
import styles from "./PropertyValuation.module.css";

const statusConfig = {
    draft: { label: "Nháp", className: styles.statusDraft },
    pending: { label: "Chờ xử lý", className: styles.statusPending },
    "in-progress": { label: "Đang thẩm định", className: styles.statusInProgress },
    completed: { label: "Hoàn thành", className: styles.statusCompleted },
    rejected: { label: "Từ chối", className: styles.statusRejected },
};

function PropertyValuation() {
    const [appraisals, setAppraisals] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const socketRef = useRef(null);
    const debounceTimers = useRef({})

    useEffect(() => {
        socketRef.current = io(window.location.origin, {
            path: "/socket.io/",
            transports: ["websocket"],
        });

        return () => {
            socketRef.current.disconnect();
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.on("appraisal:created", (newAppraisal) => {
            setAppraisals(prev => {
                const exists = prev.some(a => a._id === newAppraisal._id);
                if (exists) return prev;
                return [newAppraisal, ...prev];
            });
        });
        socket.on("appraisal:updated", (updatedAppraisal) => {
            setAppraisals(prev =>
                prev.map(a => a._id === updatedAppraisal._id ? updatedAppraisal : a)
            );
        });
        socket.on("appraisal:deleted", (deletedId) => {
            setAppraisals(prev => prev.filter(a => a._id !== deletedId));
        });

        return () => {
            socket.off("appraisal:created");
            socket.off("appraisal:updated");
            socket.off("appraisal:deleted");
            socket.off("appraisal:error");
        };
    }, []);

    useEffect(() => {
        axiosInstance.get("/api/staff/appraisals").then(res => {
            setAppraisals(res.data.data);
        });
    }, []);

    const handleChange = useCallback((id, field, value) => {
        setAppraisals(prev =>
            prev.map(a => a._id === id ? { ...a, [field]: value } : a)
        );

        const socket = socketRef.current;
        if (!socket) {
            return;
        }

        const timerKey = `${id}-${field}`;
        if (debounceTimers.current[timerKey]) {
            clearTimeout(debounceTimers.current[timerKey]);
        }

        debounceTimers.current[timerKey] = setTimeout(() => {
            socket.emit("appraisal:update", { id, field, value });
            delete debounceTimers.current[timerKey];
        }, 500);
    }, []);

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
        try {
            setAppraisals(prev => prev.filter(a => a._id !== id));
            await axiosInstance.delete(`/api/staff/appraisals/${id}`);
        } catch (error) {
            axiosInstance.get("/api/staff/appraisals").then(res => {
                setAppraisals(res.data.data);
            });
        }
    };

    const filteredAppraisals = (appraisals || []).filter(appraisal => {
        const matchesSearch =
            appraisal.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (appraisal.customerName || "").toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

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
                            {filteredAppraisals.map((appraisal) => (
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
        </div>
    );
}

export default PropertyValuation;
