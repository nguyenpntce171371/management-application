import PropertyImage from "./PropertyImage";
import PropertyInfo from "./PropertyInfo";
import styles from "./Property.module.css";

function PropertyCard({ property, viewMode, detailLink, onDelete, selected, onClick}) {
    return (
        <div className={`${viewMode === "list" ? styles.propertyCardList : styles.propertyCard} ${selected ? styles.propertyCardHover : ""}`} onClick={onClick}>
            <PropertyImage property={property} />
            <PropertyInfo property={property} detailLink={detailLink} onDelete={onDelete} />
        </div>
    );
}

export default PropertyCard;