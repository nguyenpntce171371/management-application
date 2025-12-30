import { useState, useEffect } from "react";
import { Check, MapPin, Bed, Bath, Maximize, Ruler, Layers, Compass, FileText, DollarSign, Calendar, Edit, Save, X, Phone, Info, CheckCircle } from "lucide-react";
import styles from "./RealEstateDetail.module.css";
import PageHeader from "../../components/layout/PageHeader";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axiosInstance from "../../services/axiosInstance";
import { Role } from "../../config/role";

function RealEstateDetail() {
    const { id } = useParams();
    const [property, setProperty] = useState(null);
    const [isOwner, setIsOwner] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const [formData, setFormData] = useState(property);
    const { user } = useAuth();

    useEffect(() => {
        loadDetail();
    }, [id]);

    const loadDetail = async () => {
        const res = await axiosInstance.get(`/api/real-estate/${id}`);
        setProperty(res.data.data);
        setFormData(res.data.data);
    };

    useEffect(() => {
        if (property && user) {
            const userRole = Role[(user.role || "").toUpperCase()];
            const staffRole = Role["STAFF"];
            setIsStaff(userRole && userRole.value >= staffRole.value);
            setIsOwner(user.userId === property.postedBy || (userRole && userRole.value >= staffRole.value));
        }
    }, [property, user]);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleContactChange = (index, field, value) => {
        const newContacts = [...formData.contacts];
        newContacts[index] = {
            ...newContacts[index],
            [field]: value,
        };
        setFormData((prev) => ({ ...prev, contacts: newContacts }));
    };

    const handleSave = () => {
        axiosInstance.post(`/api/real-estate/${id}`, formData)
            .then(() => { loadDetail(); })
            .finally(() => { setIsEditMode(false); });
    };

    const handleCancel = () => {
        setFormData(property);
        setIsEditMode(false);
    };

    const handleApprove = async (action) => {
        formData.status = action;
        axiosInstance.post(`/api/real-estate/${id}`, formData)
            .then(() => { loadDetail(); })
            .finally(() => { setIsEditMode(false); });
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <>
            <PageHeader title="Chi Tiết Bất Động Sản" back={true} />

            <div className={styles.content}>
                <div className={styles.statusBar}>
                    <div className={styles.statusLeft}>
                        <span className={`${styles.statusBadge} ${styles.status}`} >
                            {property.status}
                        </span>
                    </div>
                    <div className={styles.statusRight}>
                        {isStaff && property.status === "Chờ duyệt" && (
                            <button className={styles.approveButton} onClick={() => handleApprove("Đang bán")}>
                                <Check />
                                <span>Duyệt</span>
                            </button>
                        )}
                        {isOwner && property.status === "Đang bán" && (
                            <button className={styles.approveButton} onClick={() => handleApprove("Đã bán")}>
                                <CheckCircle />
                                <span>Đã bán</span>
                            </button>
                        )}
                        {isOwner && !isEditMode && (
                            <button className={styles.editButton} onClick={() => setIsEditMode(true)} >
                                <Edit />
                                <span>Chỉnh sửa</span>
                            </button>
                        )}
                        {isEditMode && (
                            <>
                                <button className={styles.saveButton} onClick={handleSave}>
                                    <Save />
                                    <span>Lưu</span>
                                </button>
                                <button className={styles.cancelButton} onClick={handleCancel}>
                                    <X />
                                    <span>Hủy</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.gallery}>
                    <div className={styles.mainImage} onClick={() => setShowImageModal(true)}>
                        <img src={property.images[selectedImage].startsWith("http") ? property.images[selectedImage] : property.imageUrls[selectedImage]} alt="Property" />
                        <div className={styles.imageOverlay}>
                            <span>
                                Xem tất cả {property.images.length} ảnh
                            </span>
                        </div>
                    </div>
                    <div className={styles.thumbnails}>
                        {property.images.map((img, idx) => (
                            <div key={idx} className={`${styles.thumbnail} ${selectedImage === idx ? styles.thumbnailActive : ""}`} onClick={() => setSelectedImage(idx)}>
                                <img src={img.startsWith("http") ? img : property.imageUrls[idx]} alt={`Thumbnail ${idx + 1}`} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.propertyInfo}>
                    <div className={styles.propertyHeader}>
                        {isEditMode ? (
                            <input type="text" value={formData.propertyType} onChange={(e) => handleInputChange("propertyType", e.target.value,)} className={styles.editInputLarge} />
                        ) : (
                            <h1 className={styles.propertyTitle}>
                                {property.propertyType}
                            </h1>
                        )}
                        {isEditMode ? (
                            <input type="text" value={formData.price} onChange={(e) => handleInputChange("price", e.target.value)} className={styles.editInputLarge} />
                        ) : (
                            <h1 className={styles.propertyTitle}>
                                {property.price}
                            </h1>
                        )}
                    </div>

                    {(property.address || isEditMode) && (
                        <div className={styles.propertyAddress}>
                            <MapPin />
                            {isEditMode ? (
                                <input type="text" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} className={styles.editInput} />
                            ) : (
                                <span>{property.address}</span>
                            )}
                        </div>
                    )}

                    <div className={styles.quickStats}>
                        {(property.area || isEditMode) && (
                            <div className={styles.statItem}>
                                <Maximize className={styles.statIcon} />
                                <div className={styles.statContent}>
                                    <div className={styles.statLabel}>
                                        Diện tích
                                    </div>
                                    {isEditMode ? (
                                        <input type="text" value={formData.area} onChange={(e) => handleInputChange("area", e.target.value,)} className={styles.editInputSmall} />
                                    ) : (
                                        <div className={styles.statValue}>
                                            {property.area}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(property.bedrooms || isEditMode) && (
                            <div className={styles.statItem}>
                                <Bed className={styles.statIcon} />
                                <div className={styles.statContent}>
                                    <div className={styles.statLabel}>
                                        Phòng ngủ
                                    </div>
                                    {isEditMode ? (
                                        <input type="number" value={formData.bedrooms} onChange={(e) => handleInputChange("bedrooms", parseInt(e.target.value),)} className={styles.editInputSmall} />
                                    ) : (
                                        <div className={styles.statValue}>
                                            {property.bedrooms}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(property.bathrooms || isEditMode) && (
                            <div className={styles.statItem}>
                                <Bath className={styles.statIcon} />
                                <div className={styles.statContent}>
                                    <div className={styles.statLabel}>
                                        Phòng tắm
                                    </div>
                                    {isEditMode ? (
                                        <input type="number" value={formData.bathrooms} onChange={(e) => handleInputChange("bathrooms", parseInt(e.target.value),)} className={styles.editInputSmall} />
                                    ) : (
                                        <div className={styles.statValue}>
                                            {property.bathrooms}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(property.floors || isEditMode) && (
                            <div className={styles.statItem}>
                                <Layers className={styles.statIcon} />
                                <div className={styles.statContent}>
                                    <div className={styles.statLabel}>
                                        Số tầng
                                    </div>
                                    {isEditMode ? (
                                        <input type="number" value={formData.floors} onChange={(e) => handleInputChange("floors", parseInt(e.target.value),)} className={styles.editInputSmall} />
                                    ) : (
                                        <div className={styles.statValue}>
                                            {property.floors}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.detailsGrid}>
                    <div className={styles.detailsSection}>
                        <div className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>
                                <Info />
                                Thông tin chi tiết
                            </h2>
                            <div className={styles.detailsList}>
                                {(property.length || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <Ruler />
                                            Chiều dài
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" value={formData.length} onChange={(e) => handleInputChange("length", e.target.value,)} className={styles.editInputSmall} />
                                        ) : (
                                            <div className={styles.detailValue}>
                                                {property.length}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(property.width || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <Ruler />
                                            Chiều rộng
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" value={formData.width} onChange={(e) => handleInputChange("width", e.target.value,)} className={styles.editInputSmall} />
                                        ) : (
                                            <div className={styles.detailValue}>
                                                {property.width}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(property.usableArea || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <Maximize />
                                            Diện tích sử dụng
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" value={formData.usableArea} onChange={(e) => handleInputChange("usableArea", e.target.value,)} className={styles.editInputSmall} />
                                        ) : (
                                            <div className={styles.detailValue}>
                                                {property.usableArea}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(property.direction || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <Compass />
                                            Hướng
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" value={formData.direction} onChange={(e) => handleInputChange("direction", e.target.value,)} className={styles.editInputSmall} />
                                        ) : (
                                            <div className={styles.detailValue}>
                                                {property.direction}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(property.legalStatus || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <FileText />
                                            Tình trạng pháp lý
                                        </div>
                                        {isEditMode ? (
                                            <input type="text" value={formData.legalStatus} onChange={(e) => handleInputChange("legalStatus", e.target.value,)} className={styles.editInputSmall} />
                                        ) : (
                                            <div className={styles.detailValue}>
                                                {property.legalStatus}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(property.listedAt || isEditMode) && (
                                    <div className={styles.detailRow}>
                                        <div className={styles.detailLabel}>
                                            <Calendar />
                                            Ngày đăng
                                        </div>
                                        <div className={styles.detailValue}>
                                            {formatDate(property.listedAt)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>
                                <FileText />
                                Mô tả
                            </h2>
                            {isEditMode ? (
                                <textarea value={formData.description} onChange={(e) => handleInputChange("description", e.target.value,)} className={styles.editTextarea} rows={6} />
                            ) : (
                                <p className={styles.description}>
                                    {property.description}
                                </p>
                            )}
                        </div>

                        <div className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>
                                <Phone />
                                Thông tin liên hệ
                            </h2>
                            <div className={styles.contactRow}>
                                {isEditMode ? (
                                    property.contacts.map(idx => (<input key={idx} type="text" value={formData.contacts[idx].phone} onChange={(e) => handleContactChange(idx, "phone", e.target.value)} className={styles.editInputSmall} />))
                                ) : (
                                    <span>{property.contacts.map(c => c.phone).filter(Boolean).join(", ")}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.sideColumn}>
                        <div className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>
                                <DollarSign />
                                Thông tin bổ sung
                            </h2>
                            <div className={styles.additionalStats}>
                                <div className={styles.additionalStatItem}>
                                    <div className={styles.additionalStatLabel}>
                                        Giá
                                    </div>
                                    <div className={styles.additionalStatValue}>
                                        {property.price ? property.price : "Thương lượng"}
                                    </div>
                                </div>
                                <div className={styles.additionalStatItem}>
                                    <div className={styles.additionalStatLabel}>
                                        Trạng thái
                                    </div>
                                    <div className={styles.additionalStatValue}>
                                        {property.status === "active" ? "Đang bán" : property.status}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showImageModal && (
                <div className={styles.modal} onClick={() => setShowImageModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={() => setShowImageModal(false)}>
                            <X />
                        </button>
                        <img src={property.images[selectedImage].startsWith("http") ? property.images[selectedImage] : property.imageUrls[selectedImage]} alt="Property" className={styles.modalImage} />
                        <div className={styles.modalThumbnails}>
                            {property.images.map((img, idx) => (
                                <div key={idx} className={`${styles.modalThumbnail} ${selectedImage === idx ? styles.modalThumbnailActive : ""}`} onClick={() => setSelectedImage(idx)}>
                                    <img src={img.startsWith("http") ? img : property.imageUrls[idx]} alt={`Thumbnail ${idx + 1}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RealEstateDetail;