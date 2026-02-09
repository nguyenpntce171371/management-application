import { useState } from "react";
import { Users, Home, FileText, Database } from "lucide-react";
import styles from "./DeletedItemsManagement.module.css";
import PageHeader from "../../components/layout/PageHeader";
import DeletedUsers from "./users/DeletedUsers";
import DeletedRealEstates from "./real-estates/DeletedRealEstates";
import DeletedAppraisals from "./appraisals/DeletedAppraisals";
import DeletedBackups from "./backups/DeletedBackups";

function DeletedItemsManagement() {
    const tabs = [
        { id: "users", label: "Người Dùng", icon: Users, component: DeletedUsers },
        { id: "real-estates", label: "Bất Động Sản", icon: Home, component: DeletedRealEstates },
        { id: "appraisals", label: "Hồ Sơ Thẩm Định", icon: FileText, component: DeletedAppraisals },
        { id: "backups", label: "Backups", icon: Database, component: DeletedBackups }
    ];

    const [activeTab, setActiveTab] = useState(tabs[0].id);

    const ActiveComponent =
        tabs.find(tab => tab.id === activeTab)?.component ?? null;

    return (
        <>
            <PageHeader title="Quản Lý Thông Tin Đã Xóa" />

            <div className={styles.content}>
                <div className={styles.tabs}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ""}`} onClick={() => setActiveTab(tab.id)}>
                                <Icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className={styles.tabContent}>
                    {ActiveComponent && <ActiveComponent />}
                </div>
            </div>
        </>
    );
}

export default DeletedItemsManagement;
