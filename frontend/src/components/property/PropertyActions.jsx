import { Eye, Trash2 } from "lucide-react";
import styles from "./Property.module.css";
import { Link } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";

function PropertyActions({ id, detailLink, onDelete }) {
    const handleDelete = async (id) => {
        await axiosInstance.delete(`/api/real-estate/${id}`);
        fetchData();
    };

    return (
        <div className={styles.propertyActions}>
            <Link to={detailLink} className={styles.actionBtn}>
                <Eye className={styles.actionBtnIcon} />
            </Link>
            {onDelete && (<button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(id)} title="Xóa">
                <Trash2 className={styles.actionBtnIcon} />
            </button>)}
        </div>
    );
}

export default PropertyActions;
