import { useState, useEffect } from "react";
import { RotateCcw, Trash2, Calendar, User as UserIcon, Users, Home, FileText, Database } from "lucide-react";
import styles from "./DeletedItemsManagement.module.css";
import axiosInstance from "../../services/axiosInstance";

function DeletedItemsManagement() {
    const [activeTab, setActiveTab] = useState("users");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const tabs = [
        {
            id: "users",
            label: "Người Dùng",
            icon: Users,
            basePath: "/api/users"
        },
        {
            id: "real-estates",
            label: "Bất Động Sản",
            icon: Home,
            basePath: "/api/real-estates"
        },
        {
            id: "appraisals",
            label: "Hồ Sơ Thẩm Định",
            icon: FileText,
            basePath: "/api/appraisals"
        },
        {
            id: "backups",
            label: "Backups",
            icon: Database,
            basePath: "/api/backups"
        }
    ];

    const currentTab = tabs.find(tab => tab.id === activeTab);

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchDeletedItems();
    }, [activeTab]);

    useEffect(() => {
        fetchDeletedItems();
    }, [pagination.page]);

    const fetchDeletedItems = async () => {
        setLoading(true);
        try {
            const endpoint = `${currentTab.basePath}/deleted`;
            const response = await axiosInstance.get(endpoint, {
                params: {
                    page: pagination.page,
                    limit: pagination.limit
                }
            });

            setItems(response.data.data);
            setPagination(prev => ({
                ...prev,
                ...response.data.pagination
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id) => {
        setRestoring(id);
        try {
            const endpoint = `${currentTab.basePath}/restore/${id}`;
            await axiosInstance.post(endpoint);
            fetchDeletedItems();
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
            const endpoint = `${currentTab.basePath}/deleted/${id}`;
            await axiosInstance.delete(endpoint);
            fetchDeletedItems();
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString("vi-VN");
    };

    const getDaysRemaining = (deletedAt) => {
        const deleted = new Date(deletedAt);
        const expiry = new Date(deleted);
        expiry.setDate(expiry.getDate() + 7);

        const now = new Date();
        const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        return daysLeft;
    };

    const renderItemInfo = (item) => {
        switch (activeTab) {
            case "users":
                return (
                    <>
                        <td>{item.fullName || "N/A"}</td>
                        <td>{item.email}</td>
                        <td>
                            <span className={`${styles.badge} ${styles[item.role?.toLowerCase()]}`}>
                                {item.role}
                            </span>
                        </td>
                    </>
                );
            case "real-estates":
                return (
                    <>
                        <td>{item.propertyType || "N/A"}</td>
                        <td className={styles.address}>{item.address || "N/A"}</td>
                        <td>{item.price || "N/A"}</td>
                        <td>{item.postedBy?.fullName || "N/A"}</td>
                    </>
                );
            case "appraisals":
                return (
                    <>
                        <td className={styles.code}>{item.code}</td>
                        <td>{item.customerName || "N/A"}</td>
                        <td>{item.propertyType || "N/A"}</td>
                        <td>{item.status || "N/A"}</td>
                    </>
                );
            case "backups":
                return (
                    <>
                        <td className={styles.code}>{item.filename}</td>
                        <td>{(item.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td>
                            <span className={`${styles.badge} ${styles[item.source]}`}>
                                {item.source}
                            </span>
                        </td>
                    </>
                );
            default:
                return <td>Unknown type</td>;
        }
    };

    const renderTableHeaders = () => {
        switch (activeTab) {
            case "users":
                return (
                    <>
                        <th>Họ Tên</th>
                        <th>Email</th>
                        <th>Vai Trò</th>
                    </>
                );
            case "real-estates":
                return (
                    <>
                        <th>Loại BĐS</th>
                        <th>Địa Chỉ</th>
                        <th>Giá</th>
                        <th>Người Đăng</th>
                    </>
                );
            case "appraisals":
                return (
                    <>
                        <th>Mã Hồ Sơ</th>
                        <th>Khách Hàng</th>
                        <th>Loại BĐS</th>
                        <th>Trạng Thái</th>
                    </>
                );
            case "backups":
                return (
                    <>
                        <th>Tên File</th>
                        <th>Dung lượng</th>
                        <th>Nguồn</th>
                    </>
                );
            default:
                return <th>Data</th>;
        }
    };

    return (
        <>
            <div className={styles.content}>
                <div className={styles.tabs}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {renderTableHeaders()}
                                <th>Ngày Xóa</th>
                                <th>Còn Lại</th>
                                <th>Xóa Bởi</th>
                                <th>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className={styles.loading}>Đang tải...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className={styles.empty}>
                                        Không có mục nào đã xóa
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => {
                                    const daysLeft = getDaysRemaining(item.deletedAt);
                                    const isExpiringSoon = daysLeft <= 2;

                                    return (
                                        <tr key={item._id} className={isExpiringSoon ? styles.expiring : ""}>
                                            {renderItemInfo(item)}
                                            <td>
                                                <div className={styles.dateInfo}>
                                                    <Calendar size={14} />
                                                    {formatDate(item.deletedAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.daysLeft} ${isExpiringSoon ? styles.warning : ""}`}>
                                                    {daysLeft > 0 ? `${daysLeft} ngày` : "Hôm nay"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.userInfo}>
                                                    <UserIcon size={14} />
                                                    {item.deletedBy?.fullName || "System"}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.actions}>
                                                    <button
                                                        className={styles.btnRestore}
                                                        onClick={() => handleRestore(item._id)}
                                                        disabled={restoring === item._id}
                                                        title="Khôi phục"
                                                    >
                                                        <RotateCcw size={16} />
                                                        {restoring === item._id ? "Đang khôi phục..." : "Khôi phục"}
                                                    </button>

                                                    <button
                                                        className={styles.btnDelete}
                                                        onClick={() => handlePermanentDelete(item._id)}
                                                        disabled={deleting === item._id}
                                                        title="Xóa vĩnh viễn"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className={styles.pagination}>
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            disabled={pagination.page === 1}
                            className={styles.paginationBtn}
                        >
                            Trang trước
                        </button>

                        <span className={styles.pageInfo}>
                            Trang {pagination.page} / {pagination.totalPages}
                        </span>

                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                            className={styles.paginationBtn}
                        >
                            Trang sau
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default DeletedItemsManagement;