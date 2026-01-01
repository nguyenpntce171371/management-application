import { useState, useRef, useEffect } from 'react';
import styles from './Profile.module.css';

export default function Profile() {
    const [activeTab, setActiveTab] = useState('info');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = useRef({});

    const [formData, setFormData] = useState({
        fullName: 'Nguyễn Văn An',
        email: 'nguyenvanan@email.com',
        phone: '0912345678',
        bio: 'Lập trình viên Full-stack với 5 năm kinh nghiệm trong phát triển web',
        company: 'Tech Solutions Co.',
        location: 'Hà Nội, Việt Nam',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const sessions = [
        {
            id: 1,
            device: 'Chrome trên Windows',
            location: 'Hà Nội, Việt Nam',
            ip: '192.168.1.1',
            lastActive: '2 phút trước',
            current: true,
        },
        {
            id: 2,
            device: 'Safari trên iPhone',
            location: 'Hà Nội, Việt Nam',
            ip: '192.168.1.45',
            lastActive: '1 giờ trước',
            current: false,
        },
        {
            id: 3,
            device: 'Chrome trên MacBook',
            location: 'TP. Hồ Chí Minh, Việt Nam',
            ip: '192.168.2.10',
            lastActive: '3 ngày trước',
            current: false,
        },
    ];

    useEffect(() => {
        const activeTabElement = tabRefs.current[activeTab];
        if (activeTabElement) {
            setTabIndicator({
                left: activeTabElement.offsetLeft,
                width: activeTabElement.offsetWidth,
            });
        }
    }, [activeTab]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditInfo = () => {
        setIsEditingInfo(true);
    };

    const handleSaveInfo = () => {
        alert('Thông tin đã được lưu!');
        setIsEditingInfo(false);
    };

    const handleCancelEdit = () => {
        setIsEditingInfo(false);
    };

    const handleChangePassword = (e) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
            alert('Mật khẩu xác nhận không khớp!');
            return;
        }
        alert('Mật khẩu đã được thay đổi!');
        setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }));
        setShowPasswordForm(false);
    };

    const handleRevokeSession = (sessionId) => {
        alert(`Đã thu hồi phiên làm việc #${sessionId}`);
    };

    const handleDeleteAccount = () => {
        if (deleteConfirm !== formData.email) {
            alert('Vui lòng nhập đúng email để xác nhận xóa tài khoản');
            return;
        }
        alert('Tài khoản đã được đánh dấu để xóa. Thao tác này sẽ hoàn tất trong 30 ngày.');
        setDeleteConfirm('');
    };

    const renderInfoTab = () => (
        <div className={styles.content}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Ảnh đại diện</h3>
                <div className={styles.avatarSection}>
                    <div className={styles.avatar}>
                        {formData.fullName.charAt(0)}
                    </div>
                    <div className={styles.avatarActions}>
                        <button type="button" className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}>
                            Tải ảnh lên
                        </button>
                        <button type="button" className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}>
                            Xóa
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Thông tin cá nhân</h3>

                <div className={styles.infoRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Họ và tên</label>
                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            className={styles.input}
                            disabled={!isEditingInfo}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={styles.input}
                            disabled={!isEditingInfo}
                        />
                    </div>
                </div>

                <div className={styles.infoRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Số điện thoại</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className={styles.input}
                            disabled={!isEditingInfo}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Công ty</label>
                        <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleInputChange}
                            className={styles.input}
                            disabled={!isEditingInfo}
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Địa chỉ</label>
                    <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className={styles.input}
                        disabled={!isEditingInfo}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Giới thiệu bản thân</label>
                    <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.textarea}`}
                        disabled={!isEditingInfo}
                    />
                </div>

                {!isEditingInfo ? (
                    <button
                        onClick={handleEditInfo}
                        className={`${styles.button} ${styles.buttonSecondary}`}
                    >
                        Chỉnh sửa
                    </button>
                ) : (
                    <div className={styles.buttonGroup}>
                        <button
                            onClick={handleSaveInfo}
                            className={`${styles.button} ${styles.buttonPrimary}`}
                        >
                            Lưu thay đổi
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            className={`${styles.button} ${styles.buttonSecondary}`}
                        >
                            Hủy
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSecurityTab = () => (
        <div className={styles.content}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Đổi mật khẩu</h3>

                {!showPasswordForm ? (
                    <div className={styles.passwordToggle}>
                        <p className={styles.subtitle}>Cập nhật mật khẩu của bạn để bảo vệ tài khoản</p>
                        <div className={styles.buttonGroup}>
                            <button
                                onClick={() => setShowPasswordForm(true)}
                                className={`${styles.button} ${styles.buttonSecondary}`}
                            >
                                Thay đổi mật khẩu
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleChangePassword}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Mật khẩu hiện tại</label>
                            <input
                                type="password"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleInputChange}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Mật khẩu mới</label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                className={styles.input}
                                required
                                minLength={8}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Xác nhận mật khẩu mới</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                className={styles.input}
                                required
                                minLength={8}
                            />
                        </div>

                        <div className={styles.buttonGroup}>
                            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
                                Cập nhật mật khẩu
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPasswordForm(false)}
                                className={`${styles.button} ${styles.buttonSecondary}`}
                            >
                                Hủy
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Xác thực hai yếu tố</h3>
                <p className={styles.subtitle}>Bảo vệ tài khoản của bạn với lớp bảo mật bổ sung</p>

                <div className={styles.buttonGroup}>
                    <button className={`${styles.button} ${styles.buttonSecondary}`}>
                        Kích hoạt 2FA
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Thiết bị đã lưu</h3>
                <p className={styles.subtitle}>Quản lý các thiết bị được ghi nhớ cho đăng nhập nhanh</p>

                <div className={styles.buttonGroup}>
                    <button className={`${styles.button} ${styles.buttonSecondary}`}>
                        Xem thiết bị (3)
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSessionsTab = () => (
        <div className={styles.content}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Phiên đăng nhập hoạt động</h3>
                <p className={styles.subtitle}>Quản lý và theo dõi các phiên đăng nhập của bạn</p>

                <div className={styles.sessionList}>
                    {sessions.map(session => (
                        <div key={session.id} className={styles.sessionItem}>
                            <div className={styles.sessionInfo}>
                                <div className={styles.sessionDevice}>
                                    {session.device}
                                    {session.current && (
                                        <span className={styles.currentBadge}>Hiện tại</span>
                                    )}
                                </div>
                                <div className={styles.sessionLocation}>
                                    {session.location} • {session.ip}
                                </div>
                                <div className={styles.sessionDate}>
                                    Hoạt động lần cuối: {session.lastActive}
                                </div>
                            </div>
                            {!session.current && (
                                <button
                                    onClick={() => handleRevokeSession(session.id)}
                                    className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
                                >
                                    Thu hồi
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className={styles.buttonGroup} style={{ marginTop: '1.5rem' }}>
                    <button className={`${styles.button} ${styles.buttonDanger}`}>
                        Đăng xuất tất cả thiết bị khác
                    </button>
                </div>
            </div>
        </div>
    );

    const renderDeleteTab = () => (
        <div className={styles.content}>
            <div className={styles.dangerZone}>
                <h3 className={styles.dangerTitle}>Xóa tài khoản</h3>
                <p className={styles.dangerText}>
                    Hành động này sẽ xóa vĩnh viễn tài khoản của bạn và tất cả dữ liệu liên quan.
                    Quá trình này không thể hoàn tác. Vui lòng cân nhắc kỹ trước khi tiếp tục.
                </p>

                <div className={styles.section} style={{ background: 'white' }}>
                    <h4 className={styles.sectionTitle}>Điều gì sẽ xảy ra khi bạn xóa tài khoản?</h4>
                    <ul style={{ paddingLeft: '1.5rem', color: '#757575', lineHeight: '1.8' }}>
                        <li style={{ marginBottom: '0.5rem' }}>Tất cả dữ liệu cá nhân sẽ bị xóa vĩnh viễn</li>
                        <li style={{ marginBottom: '0.5rem' }}>Bạn sẽ không thể khôi phục tài khoản này</li>
                        <li style={{ marginBottom: '0.5rem' }}>Các dịch vụ liên kết sẽ bị ngắt kết nối</li>
                        <li style={{ marginBottom: '0.5rem' }}>Lịch sử hoạt động sẽ bị xóa</li>
                    </ul>
                </div>

                <div className={styles.confirmGroup}>
                    <label className={styles.confirmLabel}>
                        Để xác nhận xóa tài khoản, vui lòng nhập email của bạn: <span className={styles.emailHighlight}>{formData.email}</span>
                    </label>
                    <input
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        className={styles.confirmInput}
                        placeholder="Nhập email của bạn"
                    />
                </div>

                <div className={styles.buttonGroup}>
                    <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirm !== formData.email}
                        className={`${styles.button} ${styles.buttonDanger}`}
                        style={{ opacity: deleteConfirm === formData.email ? 1 : 0.5, cursor: deleteConfirm === formData.email ? 'pointer' : 'not-allowed' }}
                    >
                        Xóa tài khoản vĩnh viễn
                    </button>
                </div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'info', label: 'Thông tin' },
        { id: 'security', label: 'Bảo mật' },
        { id: 'sessions', label: 'Quản lý Session' },
        { id: 'delete', label: 'Xóa tài khoản' },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.tabs}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        ref={el => tabRefs.current[tab.id] = el}
                        onClick={() => setActiveTab(tab.id)}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
                <div
                    className={styles.tabIndicator}
                    style={{
                        left: `${tabIndicator.left}px`,
                        width: `${tabIndicator.width}px`,
                    }}
                />
            </div>

            {activeTab === 'info' && renderInfoTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'sessions' && renderSessionsTab()}
            {activeTab === 'delete' && renderDeleteTab()}
        </div>
    );
}