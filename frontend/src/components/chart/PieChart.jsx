import { Cell, Pie, ResponsiveContainer, Tooltip, PieChart as RePieChart } from "recharts";
import styles from "./Chart.module.css";

function PieChart({ propertyTypeData }) {
    const total = propertyTypeData.reduce((sum, item) => sum + item.value, 0);
    const filteredData = propertyTypeData.filter(item => (item.value / total) * 100 >= 5);

    return (
        <div className={styles.chartContent}>
            <ResponsiveContainer width="100%" height={320}>
                <RePieChart>
                    <Pie data={filteredData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={90} fill="#8884d8" dataKey="value" strokeWidth={2} stroke="#fff">
                        {filteredData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "none", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                </RePieChart>
            </ResponsiveContainer>
        </div>
    );
}

export default PieChart;