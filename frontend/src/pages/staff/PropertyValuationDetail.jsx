import { useEffect, useState, Fragment } from "react";
import axiosInstance from "../../services/axiosInstance";
import { ChartBar } from "lucide-react";
import styles from "./PropertyValuation.module.css";
import { useParams, Link } from "react-router-dom";
import { formatNumber } from "../../hooks/useNumberFormat";
import { useSocket } from "../../context/SocketContext";
import { useNavigate } from "react-router-dom";

function PropertyValuationDetail() {
    const { id } = useParams();
    const [appraisal, setAppraisal] = useState({});
    const socket = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        if (!socket) return;

        const onUpdated = (updated) => {
            if (updated._id === id) {
                setAppraisal(updated);
            }
        };

        const onDeleted = (deletedId) => {
            if (deletedId === id) {
                navigate(-1);
            }
        };

        socket.on("appraisalUpdated", onUpdated);
        socket.on("appraisalDeleted", onDeleted);

        return () => {
            socket.off("appraisalUpdated", onUpdated);
            socket.off("appraisalDeleted", onDeleted);
        };
    }, [socket, id, navigate]);

    useEffect(() => {
        axiosInstance.get(`/api/staff/appraisals/${id}`).then(res => setAppraisal(res.data.data));
    }, [id]);

    const [totalLand, setTotalLand] = useState(0);
    const [totalConstruction, setTotalConstruction] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let landSum = 0;
        let constructionSum = 0;
        appraisal.assets?.forEach(appraisal => {
            appraisal.land?.forEach(item => {
                const price = appraisal.land?.[0].landType === item.landType ? appraisal.guidedPriceAverage : appraisal.guidedPriceAverage + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice);
                landSum += Math.round(price / 1000) * 1000 * item.landArea;
            });
        });
        appraisal.constructions?.forEach(w => {
            const money = w.area * w.unitPrice * parseFloat(w.qualityRemaining || 0) / 100;
            constructionSum += money;
        });
        setTotalLand(landSum);
        setTotalConstruction(constructionSum);
        setTotal(landSum + constructionSum);
    }, [appraisal]);

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerTop}>
                    <div className={styles.headerLeft}>
                        <div className={styles.titleWrapper}>
                            <h1 className={styles.title}>Khách hàng: {appraisal.customerName}</h1>
                            <p className={styles.subtitle}>Thẩm định viên: {appraisal.appraiser}</p>
                        </div>
                    </div>
                    <Link to={`/staff/appraisal-worksheet/${id}`} className={styles.viewSheet}>
                        <ChartBar size={20} strokeWidth={2.5} />
                        <span>Xem bảng tính</span>
                    </Link>
                </div>
            </div>

            {(appraisal.assets || appraisal.constructions) && <div className={styles.tableContainer}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th >
                                    <div className={styles.thContent}>
                                        <span>Tên tài sản</span>
                                    </div>
                                </th>
                                <th >
                                    <div className={styles.thContent}>
                                        <span>Loại đất/CLCL (%)</span>
                                    </div>
                                </th>
                                <th >
                                    <div className={styles.thContent}>
                                        <span>Diện tích (m2)</span>
                                    </div>
                                </th>
                                <th >
                                    <div className={styles.thContent}>
                                        <span>Đơn giá (VND/m2)</span>
                                    </div>
                                </th>
                                <th >
                                    <div className={styles.thContent}>
                                        <span>Thành tiền (VND)</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {appraisal.assets && appraisal.assets.map((asset, i) => (
                                <Fragment key={i}>
                                    <tr className={styles.row}>
                                        <th colSpan={4} >
                                            <div className={styles.thContent}>
                                                Tổng giá trị quyền sử dụng đất
                                            </div>
                                        </th>
                                        <th>
                                            <div className={styles.thContent}>
                                                {formatNumber(totalLand)}
                                            </div>
                                        </th>
                                    </tr>
                                    {asset.land && asset.land.map((item, u) => (
                                        <tr className={styles.row} key={`${i}-${u}`}>
                                            <td>
                                                {asset.location?.landParcel || ""}
                                            </td>
                                            <td>
                                                {item.landType || ""}
                                            </td>
                                            <td>
                                                {formatNumber(item.landArea) || ""}
                                            </td>
                                            <td>
                                                {asset.land?.[0].landType === item.landType ? formatNumber(asset.guidedPriceAverage, 3) : formatNumber(Number(asset.guidedPriceAverage) + Number(item.ontLandPrice) - Number(asset.land?.[0].ontLandPrice), 3)}
                                            </td>
                                            <td>
                                                {asset.land?.[0].landType === item.landType ? formatNumber(Math.round(Number(asset.guidedPriceAverage) / 1000) * 1000 * Number(item.landArea))
                                                    : formatNumber((Math.round(Number(asset.guidedPriceAverage) / 1000) * 1000 + Number(item.ontLandPrice) - Number(asset.land?.[0].ontLandPrice)) * Number(item.landArea))}
                                            </td>
                                        </tr>
                                    ))
                                    }
                                </Fragment>
                            ))}
                            {appraisal.constructions &&
                                <tr className={styles.row}>
                                    <th colSpan={4} >
                                        <div className={styles.thContent}>
                                            Tổng giá trị công trình xây dựng
                                        </div>
                                    </th>
                                    <th>
                                        <div className={styles.thContent}>
                                            {formatNumber(totalConstruction)}
                                        </div>
                                    </th>
                                </tr>
                            }
                            {appraisal.constructions && appraisal.constructions.map(construction => (
                                <tr className={styles.row} key={construction.id}>
                                    <td>
                                        {construction.description || ""}
                                    </td>
                                    <td>
                                        {construction.qualityRemaining || ""}
                                    </td>
                                    <td>
                                        {formatNumber(construction.appraiser) || ""}
                                    </td>
                                    <td>
                                        {formatNumber(construction.unitPrice) || ""}
                                    </td>
                                    <td>
                                        {formatNumber(Number(construction.area) * Number(construction.unitPrice) * parseFloat(construction.qualityRemaining) / 100) || ""}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <thead>
                            <tr>
                                <th colSpan={4}>
                                    <div className={styles.thContent}>
                                        <span>Tổng cộng</span>
                                    </div>
                                </th>
                                <th >
                                    <div className={styles.thContent}>
                                        {formatNumber(total)}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                    </table>
                </div>
            </div>}
        </div>
    );
}

export default PropertyValuationDetail;