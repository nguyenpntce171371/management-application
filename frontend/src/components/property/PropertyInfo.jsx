import styles from "./Property.module.css";
import { MapPin } from "lucide-react";
import PropertyActions from "./PropertyActions";

function PropertyInfo({ property, detailLink, onDelete }) {
    const formatPrice = (price) => {
        if (price >= 1_000_000_000) {
            return (price / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + " tỷ";
        }
        if (price >= 1_000_000) {
            return (price / 1_000_000).toFixed(2).replace(/\.00$/, "") + " triệu";
        }
        return price.toLocaleString("vi-VN");
    };

    return (
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
                <PropertyActions id={property._id} detailLink={detailLink} onDelete={onDelete} />
            </div>
        </div>
    );
}

export default PropertyInfo;
