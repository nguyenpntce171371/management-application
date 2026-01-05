import { Check, Eye, MapPin, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";
import styles from "./PropertyCard.module.css";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Role } from "../../config/role";
import { notify } from "../../context/NotificationContext";

function PropertyCard({ property, viewMode, detailLink, onDelete, selected, onClick, onApprove }) {
    const [isStaff, setIsStaff] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (property && user) {
            const userRole = Role[(user.role || "").toUpperCase()];
            const staffRole = Role["STAFF"];
            setIsStaff(userRole && userRole.value >= staffRole.value);
        }
    }, [property, user]);

    const formatPrice = (price) => {
        if (price >= 1_000_000_000) {
            return (price / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + " tỷ";
        }
        if (price >= 1_000_000) {
            return (price / 1_000_000).toFixed(2).replace(/\.00$/, "") + " triệu";
        }
        return price.toLocaleString("vi-VN");
    };
    const handleApprove = async (id, action) => {
        property.status = action;
        await axiosInstance.post(`/api/real-estate/${id}`, property)
            .then(() => notify({
                type: "success",
                title: "Thành công",
                message: "Cập nhật trạng thái thành công!",
            }));
    }

    const handleDelete = async (id) => {
        await axiosInstance
            .delete(`/api/real-estate/${id}`)
            .then(() => notify({
                type: "success",
                title: "Thành công",
                message: "Xóa bất động sản thành công!",
            }));
    };

    return (
        <div className={`${viewMode === "list" ? styles.propertyCardList : styles.propertyCard} ${selected ? styles.propertyCardHover : ""}`} onClick={onClick}>
            <div className={styles.propertyImage}>
                <img src={property.images?.[0]} alt={property.title} />
                <span className={styles.propertyStatus}>
                    {property.status}
                </span>
            </div>
            <div className={styles.propertyContent}>
                <div className={styles.propertyHeader}>
                    <span className={styles.propertyType}>{property.propertyType}</span>
                </div>

                <h3 className={styles.propertyName}>{property.name}</h3>

                <div className={styles.propertyLocation}>
                    <MapPin className={styles.locationIcon} />
                    <span>{property.address}</span>
                </div>

                <div className={styles.propertyFooter}>
                    <div className={styles.propertyPrice}>
                        <span className={styles.priceLabel}>Giá bán</span>
                        <span className={styles.priceValue}>{property.price ? formatPrice(property.price) : "Thương lượng"}</span>
                    </div>
                    <div className={styles.propertyActions}>
                        {(onApprove && isStaff && property.status === "Chờ duyệt") && (<button className={`${styles.actionBtn} ${styles.actionBtnApprove}`} onClick={() => handleApprove(property._id, "Đang bán")} title="Duyệt">
                            <Check className={styles.actionBtnIcon} />
                        </button>)}
                        <Link to={detailLink} className={styles.actionBtn}>
                            <Eye className={styles.actionBtnIcon} />
                        </Link>
                        {onDelete && (<button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(property._id)} title="Xóa">
                            <Trash2 className={styles.actionBtnIcon} />
                        </button>)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PropertyCard;