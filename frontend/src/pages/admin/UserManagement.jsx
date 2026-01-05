import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./UserManagement.module.css";
import { Role } from "../../config/role.js";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";
import { Trash2, Search } from "lucide-react";
import { useSocket } from "../../context/SocketContext.jsx";

function UserManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pageFromUrl = parseInt(searchParams.get("page") || "1");
    const searchFromUrl = searchParams.get("search") || "";
    const roleFromUrl = searchParams.get("role") || "all";
    const [page, setPage] = useState(pageFromUrl);
    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchFromUrl);
    const [selectedFilter, setSelectedFilter] = useState(roleFromUrl);
    const [users, setUsers] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const socket = useSocket();
    const [limit] = useState(20);

    useEffect(() => {
        setPage(pageFromUrl);
        setSearchTerm(searchFromUrl);
        setDebouncedSearchTerm(searchFromUrl);
        setSelectedFilter(roleFromUrl);
    }, [pageFromUrl, searchFromUrl, roleFromUrl]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            updateParams({ search: searchTerm, page: 1 });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const fetchUsers = useCallback(async () => {
        const res = await axiosInstance.get("/api/user/get-users", {
            params: {
                page,
                limit,
                role: selectedFilter === "all" ? undefined : selectedFilter,
                search: debouncedSearchTerm || undefined,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        });

        const newData = res.data?.data ?? [];
        const pagination = res.data?.pagination;

        setUsers(newData);
        setTotalPages(pagination?.totalPages ?? 1);
        setTotalItems(pagination?.total ?? 0);
    }, [page, selectedFilter, debouncedSearchTerm, limit]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (!socket) return;

        const onUserCreated = () => {
            fetchUsers();
        };

        const onUserUpdated = (updatedUser) => {
            setUsers(prev =>
                prev.map(u => (u._id === updatedUser._id ? updatedUser : u))
            );
        };

        const onUserDeleted = () => {
            fetchUsers();
        };

        socket.on("newUserRegistered", onUserCreated);
        socket.on("userRoleChanged", onUserUpdated);
        socket.on("userUpdated", onUserUpdated);
        socket.on("userDeleted", onUserDeleted);

        return () => {
            socket.off("newUserRegistered", onUserCreated);
            socket.off("userRoleChanged", onUserUpdated);
            socket.off("userUpdated", onUserUpdated);
            socket.off("userDeleted", onUserDeleted);
        };
    }, [socket, fetchUsers]);

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

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateParams({ page: newPage });
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handleDeleteUser = async (email) => {
        await axiosInstance.delete(`/api/admin/delete-user`, { data: { email } });
    };

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <PageHeader title="Quản Lý Người Dùng" />

                <div className={styles.content}>
                    <div className={styles.searchFilterBar}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} />
                            <input type="text" placeholder="Tìm kiếm theo tên, email..." className={styles.searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className={styles.filterTabs}>
                            {filterTabs.map(filter => (
                                <button key={filter.id} onClick={() => updateParams({ role: filter.id, page: 1 })} className={`${styles.filterTab} ${selectedFilter === filter.id ? styles.filterTabActive : ""}`}>
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
                                {users.map(user => (
                                    <tr key={user._id} className={styles.tableRow}>
                                        <td className={styles.tableCell}>{user.fullName}</td>
                                        <td className={styles.tableCell}>{user.email}</td>
                                        <td className={styles.tableCell}><div className={styles.userActions}>{user.phone}</div></td>
                                        <td className={styles.tableCell}>{user.location}</td>
                                        <td className={styles.tableCell}>
                                            <div className={styles.userActions}>
                                                <span className={`${styles.roleBadge} ${styles[`role${getRoleInfo(user.role).class.charAt(0).toUpperCase() + getRoleInfo(user.role).class.slice(1)}`]}`}>
                                                    {getRoleInfo(user.role).label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={styles.tableCell}>
                                            <div className={styles.userActions}>
                                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Xóa" onClick={() => handleDeleteUser(user.email)}>
                                                    <Trash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
            </main>
        </div>
    );
}

export default UserManagement;