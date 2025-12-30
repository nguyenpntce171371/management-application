import styles from "./Chart.module.css";
import { ResponsiveContainer, BarChart as ReBarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";

function BarChart({ locationData }) {
    const validData = (locationData || []).filter(item => {
        return item &&
            item.location &&
            typeof item.location === "string" &&
            item.location.trim() !== "" &&
            item.count != null &&
            item.count > 0;
    });

    const limitedData = validData
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return (
        <div className={styles.chartContent}>
            <ResponsiveContainer width="100%" height={300}>
                <ReBarChart data={limitedData }>
                    <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#D4AF37" />
                            <stop offset="100%" stopColor="#A67C00" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="location" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                        }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="url(#barGradient)" radius={[8, 8, 0, 0]} name="Số lượng BĐS" />
                </ReBarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default BarChart;