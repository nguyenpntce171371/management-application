import styles from "./Property.module.css";

function PropertyImage({ property }) {
    return (
        <div className={styles.propertyImage}>
            <img src={property.images?.[0].startsWith("http") ? property.images?.[0] : property.imageUrls?.[0]} alt={property.title} />
            <span className={styles.propertyStatus}>
                {property.status}
            </span>
        </div>
    );
}

export default PropertyImage;
