import { useState, useEffect, useRef } from "react";
import { Check, MapPin, Bed, Bath, Maximize, Ruler, Layers, Compass, FileText, Calendar, Edit, Save, X, Phone, Info, CheckCircle, Trash, Upload, XCircle } from "lucide-react";
import styles from "./RealEstateDetail.module.css";
import PageHeader from "../../../components/layout/PageHeader";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import axiosInstance from "../../../services/axiosInstance";
import { Role } from "../../../config/role";
import { notify } from "../../../context/NotificationContext";

function RealEstateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [isOwner, setIsOwner] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const [formData, setFormData] = useState(property);
    const [newImages, setNewImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);
    const [previewImages, setPreviewImages] = useState([]);
    const fileInputRef = useRef(null);
    const { user } = useAuth();

    const MAX_IMAGES = 10;

    useEffect(() => {
        loadDetail();
    }, [id]);

    const loadDetail = async () => {
        const res = await axiosInstance.get(`/api/real-estates/${id}`);
        setProperty(res.data.data);
        setFormData(res.data.data);
        setPreviewImages(res.data.data.images || []);
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

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const currentCount = previewImages.length;
        const remainSlots = MAX_IMAGES - currentCount;

        if (remainSlots <= 0) {
            notify({
                type: "error",
                title: "Quá số lượng",
                message: "Chỉ được upload tối đa 10 ảnh",
            });
            return;
        }

        const acceptedFiles = files.slice(0, remainSlots);

        if (files.length > remainSlots) {
            notify({
                type: "error",
                title: "Quá số lượng",
                message: "Chỉ được upload tối đa 10 ảnh",
            });
        }

        setNewImages(prev => [...prev, ...acceptedFiles]);

        const newPreviews = acceptedFiles.map(file =>
            URL.createObjectURL(file)
        );

        setPreviewImages(prev => [...prev, ...newPreviews]);

        e.target.value = "";
    };

    const handleDeleteImage = (index) => {
        const imageToDelete = previewImages[index];

        if (property.images.includes(imageToDelete)) {
            setDeletedImages(prev => [...prev, imageToDelete]);
        } else {
            const newImageIndex = previewImages.slice(0, index).filter(img => !property.images.includes(img)).length;
            setNewImages(prev => prev.filter((_, i) => i !== newImageIndex));
        }

        setPreviewImages(prev => prev.filter((_, i) => i !== index));

        if (selectedImage >= index && selectedImage > 0) {
            setSelectedImage(selectedImage - 1);
        }
    };

    const handleSave = async () => {
        if (previewImages.length > MAX_IMAGES) {
            notify({
                type: "error",
                title: "Quá số lượng",
                message: "Chỉ được upload tối đa 10 ảnh",
            });
            return;
        }

        const formDataToSend = new FormData();

        Object.keys(formData).forEach(key => {
            if (key !== "images" && key !== "contacts") {
                formDataToSend.append(key, formData[key]);
            }
        });

        formDataToSend.append("contacts", JSON.stringify(formData.contacts));

        if (deletedImages.length > 0) {
            formDataToSend.append("deletedImages", JSON.stringify(deletedImages));
        }

        newImages.forEach((file) => {
            formDataToSend.append("images", file);
        });

        await axiosInstance.post(`/api/real-estates/${id}`, formDataToSend, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        setNewImages([]);
        setDeletedImages([]);
        await loadDetail();
        setIsEditMode(false);
    };

    const handleCancel = () => {
        setFormData(property);
        setPreviewImages(property.images || []);
        setNewImages([]);
        setDeletedImages([]);
        setIsEditMode(false);
    };

    const handleApprove = async (action) => {
        await axiosInstance.post(`/api/real-estates/${id}`, {
            ...property,
            status: action,
        });
        await loadDetail();
    };

    const handleDelete = async () => {
        await axiosInstance.delete(`/api/real-estates/${id}`);
        navigate(-1);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    if (!property) {
        return <div>Loading...</div>;
    }

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
                        {!isEditMode && (
                            isOwner && (
                                <>
                                    <button className={styles.editButton} onClick={() => setIsEditMode(true)} >
                                        <Edit />
                                        <span>Chỉnh sửa</span>
                                    </button>
                                    <button className={styles.deleteButton} onClick={() => handleDelete()} >
                                        <Trash />
                                        <span>Xóa</span>
                                    </button>
                                </>
                            )
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
                    <div className={styles.mainImage} onClick={() => !isEditMode && setShowImageModal(true)}>
                        <>
                            <img src={previewImages[selectedImage]} alt="Property" />
                            {!isEditMode && (
                                <div className={styles.imageOverlay}>
                                    <span>
                                        Xem tất cả {previewImages.length} ảnh
                                    </span>
                                </div>
                            )}
                        </>
                    </div>
                    <div className={styles.thumbnails}>
                        {previewImages.map((img, idx) => (
                            <div key={idx} className={`${styles.thumbnail} ${selectedImage === idx ? styles.thumbnailActive : ""}`}>
                                <img src={img} alt={`Thumbnail ${idx + 1}`} onClick={() => setSelectedImage(idx)} />
                                {isEditMode && (
                                    <button className={styles.deleteImageBtn} onClick={() => handleDeleteImage(idx)} title="Xóa ảnh">
                                        <XCircle size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {isEditMode && previewImages.length < MAX_IMAGES && (
                            <div className={styles.uploadThumbnail} onClick={() => fileInputRef.current?.click()}>
                                <Upload size={24} />
                                <span>Thêm ảnh</span>
                                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                            </div>
                        )}
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
                                        {formatDate(property.createdAt)}
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
                                property.contacts.map((c, i) => (<input key={i} type="text" value={formData.contacts[i].phone} onChange={(e) => handleContactChange(i, "phone", e.target.value)} className={styles.editInputSmall} />))
                            ) : (
                                <span>{property.contacts.map(c => c.phone).filter(Boolean).join(", ")}</span>
                            )}
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
                        <img src={property.images[selectedImage]} alt="Property" className={styles.modalImage} />
                        <div className={styles.modalThumbnails}>
                            {property.images.map((img, idx) => (
                                <div key={idx} className={`${styles.modalThumbnail} ${selectedImage === idx ? styles.modalThumbnailActive : ""}`} onClick={() => setSelectedImage(idx)}>
                                    <img src={img} alt={`Thumbnail ${idx + 1}`} />
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