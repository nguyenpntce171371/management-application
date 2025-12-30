import { ImagePlus, Save } from "lucide-react";
import { useState } from "react";
import styles from "./AddRealEstate.module.css";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";
import provinces from "../../data/vietnam-provinces.json";

function AddRealEstate() {
    const [formData, setFormData] = useState({
        propertyType: "",
        price: "",
        length: "",
        width: "",
        area: "",
        usableArea: "",
        bedrooms: "",
        bathrooms: "",
        address: "",
        province: "",
        district: "",
        ward: "",
        street: "",
        description: "",
        lat: "",
        lng: "",
        name: "",
        phone: ""
    });

    const [images, setImages] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const handleProvinceChange = (e) => {
        const provinceName = e.target.value;
        const selectedProvince = provinces.find(p => p.name === provinceName);
        setFormData({ ...formData, province: provinceName, district: "", ward: "" });
        setDistricts(selectedProvince ? selectedProvince.districts : []);
        setWards([]);
    };

    const handleDistrictChange = (e) => {
        const districtName = e.target.value;
        const selectedDistrict = districts.find(d => d.name === districtName);
        setFormData({ ...formData, district: districtName, ward: "" });
        setWards(selectedDistrict ? selectedDistrict.wards : []);
    };

    const handleNumberInput = (e, field) => {
        const value = e.target.value.replace(/\D/g, "");
        setFormData({ ...formData, [field]: value });
    };

    const handleDecimalInput = (e, field) => {
        const value = e.target.value.replace(/[^\d.-]/g, "").replace(/(\..*)\./g, "$1").replace(/(?!^)-/g, "");
        setFormData({ ...formData, [field]: value });
    };

    const handlePhoneInput = (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 11);
        setFormData({ ...formData, phone: value });
    };

    const handleImageUpload = (e) => {
        const files = e.target.files;
        if (files) {
            const newImages = Array.from(files).map(file => URL.createObjectURL(file));
            setImages([...images, ...newImages]);
        }
    };

    const removeImage = (index) => {
        URL.revokeObjectURL(images[index]);
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const submitData = new FormData();

        Object.keys(formData).forEach(key => {
            if (formData[key]) {
                submitData.append(key, formData[key]);
            }
        });

        const fileInput = document.querySelector("input[type='file']");
        if (fileInput && fileInput.files) {
            Array.from(fileInput.files).forEach(file => {
                submitData.append("images", file);
            });
        }

        const response = await axiosInstance.post("/api/real-estate", submitData, { headers: { "Content-Type": "multipart/form-data" } });

        if (response.data.success) {
            setFormData({ propertyType: "", price: "", length: "", width: "", usableArea: "", bedrooms: "", bathrooms: "", address: "", province: "", district: "", ward: "", street: "", description: "", lat: "", lng: "", name: "", phone: "" });
            setImages([]);
        }
    };

    return (
        <div className={styles.container}>
            <PageHeader title="Thêm Bất Động Sản Mới" />

            <form onSubmit={handleSubmit} className={styles.formContent}>
                <div className={styles.formGrid}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Thông Tin Cơ Bản</h2>
                            <p className={styles.sectionSubtitle}>Nhập thông tin chính về bất động sản</p>
                        </div>
                        <div className={styles.fieldGrid}>
                            <div className={styles.fieldFull}>
                                <label htmlFor="propertyType" className={styles.label}>
                                    Tên bất động sản <span className={styles.required}>*</span>
                                </label>
                                <input id="propertyType" type="text" className={styles.input} placeholder="VD: Căn hộ Vinhomes Central Park" value={formData.propertyType} onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })} required />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="price" className={styles.label}>
                                    Giá (VNĐ)
                                </label>
                                <input id="price" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 4500000000 hoặc bỏ trống" value={formData.price} onChange={(e) => handleNumberInput(e, "price")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="length" className={styles.label}>
                                    Dài (m) <span className={styles.required}>*</span>
                                </label>
                                <input id="length" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 13" value={formData.length} onChange={(e) => handleNumberInput(e, "length")} required />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="width" className={styles.label}>
                                    Rộng (m²) <span className={styles.required}>*</span>
                                </label>
                                <input id="width" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 15" value={formData.width} onChange={(e) => handleNumberInput(e, "width")} required />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="area" className={styles.label}>
                                    Diện tích sàn (m²)
                                </label>
                                <input id="area" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 85" value={formData.area} onChange={(e) => handleNumberInput(e, "area")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="usableArea" className={styles.label}>
                                    Diện tích sử dụng (m²)
                                </label>
                                <input id="usableArea" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 85" value={formData.usableArea} onChange={(e) => handleNumberInput(e, "usableArea")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="bedrooms" className={styles.label}>
                                    Số phòng ngủ
                                </label>
                                <input id="bedrooms" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 3" value={formData.bedrooms} onChange={(e) => handleNumberInput(e, "bedrooms")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="bathrooms" className={styles.label}>
                                    Số phòng tắm
                                </label>
                                <input id="bathrooms" type="text" inputMode="numeric" className={styles.input} placeholder="VD: 2" value={formData.bathrooms} onChange={(e) => handleNumberInput(e, "bathrooms")} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleRow}>
                                <div>
                                    <h2 className={styles.sectionTitle}>Thông Tin Vị Trí</h2>
                                    <p className={styles.sectionSubtitle}>Địa chỉ và vị trí bất động sản</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}>
                                <label htmlFor="province" className={styles.label}>Tỉnh/Thành phố <span className={styles.required}>*</span></label>
                                <select id="province" className={styles.select} value={formData.province} onChange={handleProvinceChange} required>
                                    <option value="">Chọn tỉnh/thành phố</option>
                                    {provinces.map((province) => (
                                        <option key={province.code} value={province.name}>{province.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="district" className={styles.label}>Quận/Huyện <span className={styles.required}>*</span></label>
                                <select id="district" className={styles.select} value={formData.district} onChange={handleDistrictChange} required>
                                    <option value="">Chọn quận/huyện</option>
                                    {districts.map((district) => (
                                        <option key={district.code} value={district.name}>{district.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="ward" className={styles.label}>Phường/Xã <span className={styles.required}>*</span></label>
                                <select id="ward" className={styles.select} value={formData.ward} onChange={(e) => setFormData({ ...formData, ward: e.target.value })} required>
                                    <option value="">Chọn phường/xã</option>
                                    {wards.map((ward) => (
                                        <option key={ward.code} value={ward.name}>{ward.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="street" className={styles.label}>Đường <span className={styles.required}>*</span></label>
                                <input id="street" type="text" className={styles.input} placeholder="VD: Nguyễn Hữu Cảnh" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} required />
                            </div>
                            <div className={styles.fieldFull}>
                                <label htmlFor="address" className={styles.label}>
                                    Địa chỉ chi tiết
                                </label>
                                <input id="address" type="text" className={styles.input} placeholder="VD: Đối diện Trường Tiểu học A" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="lat" className={styles.label}>
                                    Vĩ độ (Latitude)
                                </label>
                                <input id="lat" type="text" inputMode="decimal" className={styles.input} placeholder="VD: 10.799123" value={formData.lat} onChange={(e) => handleDecimalInput(e, "lat")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="lng" className={styles.label}>
                                    Kinh độ (Longitude)
                                </label>
                                <input id="lng" type="text" inputMode="decimal" className={styles.input} placeholder="VD: 106.720456" value={formData.lng} onChange={(e) => handleDecimalInput(e, "lng")} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Mô Tả Chi Tiết</h2>
                            <p className={styles.sectionSubtitle}>Mô tả đầy đủ về bất động sản</p>
                        </div>
                        <div className={styles.fieldGrid}>
                            <div className={styles.fieldFull}>
                                <label htmlFor="description" className={styles.label}>
                                    Mô tả
                                </label>
                                <textarea id="description" className={styles.textarea} placeholder="Nhập mô tả chi tiết về bất động sản, các tiện ích, đặc điểm nổi bật..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={6} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Thông tin liên hệ</h2>
                            <p className={styles.sectionSubtitle}>Thông tin để người mua liên hệ trao đổi trực tiếp</p>
                        </div>
                        <div className={styles.fieldGrid}>
                            <div className={styles.fieldFull}>
                                <label htmlFor="name" className={styles.label}>
                                    Họ và tên
                                </label>
                                <input id="name" type="text" className={styles.input} placeholder="VD: Nguyễn Văn A" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className={styles.fieldFull}>
                                <label htmlFor="phone" className={styles.label}>
                                    Số điện thoại <span className={styles.required}>*</span>
                                </label>
                                <input id="phone" type="tel" inputMode="tel" className={styles.input} placeholder="VD: 0123456789" value={formData.phone} onChange={handlePhoneInput} maxLength={11} required />
                            </div>
                        </div>
                    </div>

                    <div className={styles.sectionFull}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Hình Ảnh</h2>
                            <p className={styles.sectionSubtitle}>Thêm ảnh bất động sản (tối đa 10 ảnh)</p>
                        </div>
                        <div className={styles.imageSection}>
                            <div className={styles.imageGrid}>
                                {images.map((image, index) => (
                                    <div key={index} className={styles.imagePreview}>
                                        <img src={image} alt={`Preview ${index + 1}`} className={styles.previewImage} />
                                        <button type="button" className={styles.removeImageButton} onClick={() => removeImage(index)}>
                                            x
                                        </button>
                                    </div>
                                ))}
                                {images.length < 10 && (
                                    <label className={styles.uploadBox}>
                                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className={styles.fileInput} />
                                        <ImagePlus className={styles.uploadIcon} />
                                        <span className={styles.uploadText}>Thêm ảnh</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.actionBar}>
                    <button type="submit" className={styles.submitButton}>
                        <Save className={styles.buttonIcon} />
                        Lưu bất động sản
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddRealEstate;