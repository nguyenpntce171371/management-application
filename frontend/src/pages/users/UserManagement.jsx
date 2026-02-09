import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./UserManagement.module.css";
import { Role } from "../../config/role.js";
import PageHeader from "../../components/layout/PageHeader.jsx";
import axiosInstance from "../../services/axiosInstance.jsx";
import { Trash2, ChevronDown } from "lucide-react";
import { useSocket } from "../../context/SocketContext.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import SearchField from "../../components/common/SearchField.jsx";

function UserManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const socket = useSocket();

    const searchFromUrl = searchParams.get("search") || "";
    const roleFromUrl = searchParams.get("role") || "all";

    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
    const [selectedFilter, setSelectedFilter] = useState(roleFromUrl);
    const filterTabs = [
        { id: "all", label: "Tất cả" },
        ...Object.entries(Role).filter(([key]) => key !== "GUEST").map(([key, info]) => ({
            id: info.class,
            label: info.label
        }))
    ];

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [direction, setDirection] = useState("next");
    const [nextCursor, setNextCursor] = useState(null);
    const [prevCursor, setPrevCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const limit = 21;

    useEffect(() => {
        setSearchTerm(searchFromUrl);
        setDebouncedSearch(searchFromUrl);
        setSelectedFilter(roleFromUrl);
    }, [searchFromUrl, roleFromUrl]);

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
    }, [debouncedSearch, selectedFilter]);

    const fetchData = useCallback(async () => {
        const res = await axiosInstance.get("/api/users", {
            params: {
                limit,
                cursor,
                direction,
                search: debouncedSearch,
                role: selectedFilter
            }
        });
        const { data, pagination } = res.data;
        setItems(data || []);
        setHasMore(!!pagination?.hasMore);
        setHasPrev(!!pagination?.hasPrev);
        setNextCursor(pagination?.nextCursor || null);
        setPrevCursor(pagination?.prevCursor || null);
    }, [limit, cursor, direction, debouncedSearch, selectedFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;

        const refresh = () => fetchData();

        socket.on("userCreated", refresh);
        socket.on("userRestored", refresh);
        socket.on("userDeleted", refresh);
        socket.on("userUpdated", refresh);

        return () => {
            socket.off("userCreated", refresh);
            socket.off("userRestored", refresh);
            socket.off("userDeleted", refresh);
            socket.off("userUpdated", refresh);
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

    const handleDeleteUser = async (id) => {
        await axiosInstance.delete(`/api/users/${id}`);
    };

    const handleRoleChange = async (id, newRole) => {
        await axiosInstance.post("/api/users/role", { id, role: newRole });
    };

    return (
        <>
            <PageHeader title="Danh Sách Bất Động Sản" />
            <div className={styles.content}>
                <div className={styles.searchFilterBar}>
                    <div className={styles.searchWrapper}>
                        <SearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Tìm kiếm theo tên, email hoặc địa điểm..." />
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
                                <th className={styles.tableHeader}>Địa chỉ</th>
                                <th className={styles.tableHeader}>Vai trò</th>
                                <th className={styles.tableHeader}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className={styles.tableBody}>
                            {(items ?? []).map((user) => (
                                <tr key={user.id} className={styles.tableRow}>
                                    <td className={styles.tableCell}>{user.fullName}</td>
                                    <td className={styles.tableCell}>{user.email}</td>
                                    <td className={styles.tableCell}>{user.address}</td>
                                    <td className={styles.tableCell}>
                                        <div className={styles.userActions}>
                                            <div className={styles.roleSelectWrapper}>
                                                <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value, user.id)} className={`${styles.roleSelect} ${styles[`role${user.role}`]}`}>
                                                    <option value={"User"}>{"User"}</option>
                                                    <option value={"Staff"}>{"Staff"}</option>
                                                    <option value={"Admin"}>{"Admin"}</option>
                                                </select>
                                                <ChevronDown className={styles.roleSelectIcon} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className={styles.tableCell}>
                                        <div className={styles.userActions}>
                                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Xóa" onClick={() => handleDeleteUser(user.id)}>
                                                <Trash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
            </div>
        </>
    );
}

export default UserManagement;
