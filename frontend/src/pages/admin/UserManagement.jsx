import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./UserManagement.module.css";
import { Role } from "../../config/role.js";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";
import { io } from "socket.io-client";
import { Trash2, Search, X } from "lucide-react";

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

    const loadingRef = useRef(false);
    const hasMoreRef = useRef(true);
    const socketRef = useRef(null);

    useEffect(() => { loadingRef.current = loading }, [loading]);
    useEffect(() => { hasMoreRef.current = hasMore }, [hasMore]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchUsers = useCallback(async (reset = false) => {
        if (loadingRef.current) return;
        setLoading(true);

        try {
            const res = await axiosInstance.get("/api/user/get-users", {
                params: {
                    page: reset ? 1 : page,
                    limit: 20,
                    role: selectedFilter === "all" ? undefined : selectedFilter,
                    search: debouncedSearchTerm || undefined,
                    sortBy: "createdAt",
                    sortOrder: "desc"
                }
            });

            const newData = res.data?.data ?? [];
            const pagination = res.data?.pagination;

            if (reset) {
                setUsers(newData);
                setHasMore(pagination?.hasMore);
            } else {
                setUsers(prev => [...prev, ...newData]);
                setHasMore(pagination?.hasMore);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }, [page, selectedFilter, debouncedSearchTerm]);

    useEffect(() => {
        fetchUsers(page === 1);
    }, [fetchUsers, page]);

    useEffect(() => {
        socketRef.current = io("http://192.168.136.142", {
            path: "/socket.io/",
            transports: ["websocket"],
        });

        const s = socketRef.current;

        s.on("user:created", (newUser) => {
            if (selectedFilter === "all" || newUser.role === selectedFilter) {
                setUsers(prev => [newUser, ...prev]);
            }
        });

        s.on("user:updated", (updatedUser) => {
            setUsers(prev => prev.map(u => (u._id === updatedUser._id ? updatedUser : u)));
        });

        s.on("user:deleted", (deletedId) => {
            setUsers(prev => prev.filter(u => u._id !== deletedId));
        });

        return () => s.disconnect();
    }, [selectedFilter]);

    const getRoleInfo = (role) => {
        if (!role) return Role.GUEST;
        const key = String(role).trim().toUpperCase();
        return Role[key] || Role.GUEST;
    };

    const filterTabs = [
        { id: "all", label: "Tất cả" },
        ...Object.entries(Role)
            .filter(([key]) => key !== "GUEST")
            .map(([key, info]) => ({
                id: info.class,
                label: info.label
            }))
    ];

    const totalPages = Math.ceil((users.length / 20) || 1);

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <PageHeader title="Quản Lý Người Dùng" />

                <div className={styles.content}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>Danh Sách Người Dùng</h2>
                            <p className={styles.sectionSubtitle}>Quản lý tất cả tài khoản trong hệ thống</p>
                        </div>
                    </div>
                    <div className={styles.sectionHeader}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} />
                            <input type="text" placeholder="Tìm kiếm theo tên, email..." className={styles.searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className={styles.filterTabs}>
                            {filterTabs.map(filter => (
                                <button key={filter.id} onClick={() => { setSelectedFilter(filter.id); setPage(1); }} className={`${styles.filterTab} ${selectedFilter === filter.id ? styles.filterTabActive : ""}`}>
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.usersTable}>
                            <thead className={styles.tableHead}>
                                <tr>
                                    <th className={styles.tableHeader}>Tên</th>
                                    <th className={styles.tableHeader}>Email</th>
                                    <th className={styles.tableHeader}>Số điện thoại</th>
                                    <th className={styles.tableHeader}>Địa chỉ</th>
                                    <th className={styles.tableHeader}>Vai trò</th>
                                    <th className={styles.tableHeader}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                                {users.map(user => {
                                    const roleInfo = getRoleInfo(user.role);
                                    return (
                                        <tr key={user._id} className={styles.tableRow}>
                                            <td className={styles.tableCell}>{user.fullName}</td>
                                            <td className={styles.tableCell}>{user.email}</td>
                                            <td className={styles.tableCell}><div className={styles.userActions}>{user.phone}</div></td>
                                            <td className={styles.tableCell}>{user.location}</td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.userActions}>
                                                    <span className={`${styles.roleBadge} ${styles[`role${roleInfo.class.charAt(0).toUpperCase() + roleInfo.class.slice(1)}`]}`}>
                                                        {roleInfo.label}
                                                    </span>
                                                </div>

                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.userActions}>
                                                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Xóa">
                                                        <Trash2 />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {loading && (
                            <div className={styles.loadingContainer}>
                                <div className={styles.spinner}></div>
                                <p className={styles.loadingText}>Đang tải...</p>
                            </div>
                        )}
                    </div>

                    <div className={styles.paginationContainer}>
                        <button onClick={() => setPage(p => Math.max(p - 1, 1))} className={styles.pageNavButton} disabled={page === 1}>Trước</button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button key={i + 1} onClick={() => setPage(i + 1)} className={`${styles.pageButton} ${page === i + 1 ? styles.pageButtonActive : ""}`}>
                                {i + 1}
                            </button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} className={styles.pageNavButton} disabled={page === totalPages}>Sau</button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default UserManagement;
