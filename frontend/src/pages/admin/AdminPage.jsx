import { ArrowUpRight, Building2, Users } from "lucide-react";
import StatsCard from "../../components/card/StatsCard";
import PageHeader from "../../components/layout/PageHeader";
import styles from "./AdminPage.module.css";
import PieChart from "../../components/chart/PieChart";
import BarChart from "../../components/chart/BarChart";
import PropertyCard from "../../components/card/PropertyCard";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axiosInstance from "../../services/axiosInstance";

function AdminPage() {
    const [stats, setStats] = useState({
        totalUser: null,
        totalRealEstate: null,
        realEstateTypeStats: [],
        realEstateLocationStats: [],
        recentProperties: [],
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const [realEstateRes, userRes, latestRes] = await Promise.all([
            axiosInstance.get("/api/real-estate/stats"),
            axiosInstance.get("/api/user/stats"),
            axiosInstance.get("/api/real-estate", {
                params: {
                    page: 1,
                    limit: 5,
                    sortBy: "createdAt",
                    sortOrder: "desc",
                    status: "Đang bán"
                },
            }),
        ]);
        const realEstate = realEstateRes.data?.data ?? {};
        const userCount = userRes.data?.data ?? 0;
        const latestProperties = latestRes.data?.data ?? [];
        const COLORS = ["#D4AF37", "#1E40AF", "#059669", "#DC2626", "#7C3AED", "#F59E0B", "#0EA5E9"];
        setStats({
            totalUser: {
                title: "Người Dùng",
                value: userCount.toLocaleString("vi-VN"),
                Icon: Users,
                colorClass: "blue",
                colorKey: "statCardBlue",
                iconColorKey: "statIconBlue",
                route: "/admin/user-management",
            },
            totalRealEstate: {
                title: "Tổng BĐS",
                value: (realEstate.total ?? 0).toLocaleString("vi-VN"),
                Icon: Building2,
                colorClass: "gold",
                colorKey: "statCardGold",
                iconColorKey: "statIconGold",
                route: "/staff/real-estate",
            },
            realEstateTypeStats: (realEstate.propertyTypeDistribution ?? []).map(
                (item, i) => ({
                    name: item.propertyType,
                    value: item.count,
                    color: COLORS[i % COLORS.length],
                })
            ),
            realEstateLocationStats: (realEstate.topProvinces ?? []).map(
                item => ({
                    location: item.province,
                    count: item.count,
                })
            ),
            recentProperties: latestProperties,
        });
    };

    return (
        <>
            <PageHeader title="Chào mừng trở lại, Admin" />
            <div className={styles.content}>
                <div className={styles.statsGrid}>
                    {stats.totalUser && (<StatsCard title={stats.totalUser.title} value={stats.totalUser.value} Icon={stats.totalUser.Icon} colorKey={stats.totalUser.colorKey} iconColorKey={stats.totalUser.iconColorKey} route={stats.totalUser.route} />)}
                    {stats.totalRealEstate && (<StatsCard title={stats.totalRealEstate.title} value={stats.totalRealEstate.value} Icon={stats.totalRealEstate.Icon} colorKey={stats.totalRealEstate.colorKey} iconColorKey={stats.totalRealEstate.iconColorKey} route={stats.totalRealEstate.route} />)}
                </div>
                <div className={styles.chartsGrid}>
                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div>
                                <h3 className={styles.chartTitle}>Phân Bố Theo Khu Vực</h3>
                                <p className={styles.chartSubtitle}>Top 5 thành phố có nhiều BĐS nhất</p>
                            </div>
                        </div>
                        {stats.realEstateLocationStats && (<BarChart locationData={stats.realEstateLocationStats} />)}
                    </div>
                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div>
                                <h3 className={styles.chartTitle}>Phân Loại BĐS</h3>
                                <p className={styles.chartSubtitle}>Theo loại hình</p>
                            </div>
                        </div>
                        {stats.realEstateTypeStats && (<PieChart propertyTypeData={stats.realEstateTypeStats} />)}
                    </div>
                </div>
                <div className={styles.propertiesSection}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>Bất Động Sản Mới Nhất</h2>
                            <p className={styles.sectionSubtitle}>Các dự án được đăng gần đây</p>
                        </div>
                        <Link to="/staff/real-estate" className={styles.viewAllButton}>
                            Xem tất cả
                            <ArrowUpRight className={styles.viewAllIcon} />
                        </Link>
                    </div>

                    <div className={styles.propertiesGrid}>
                        {stats.recentProperties.map((property) => (
                            <PropertyCard key={property._id} property={property} detailLink={`/staff/real-estate/${property._id}`} />
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

export default AdminPage;
