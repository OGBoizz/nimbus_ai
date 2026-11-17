
import { useEffect, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Database,
  RefreshCw,
  Send,
  Activity,
  TrendingUp,
  Users,
  IndianRupee,
  Bot,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import "./App.css";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const percentage = (value) =>
  `${(Number(value || 0) * 100).toFixed(1)}%`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    color: "#182230",
    fontFamily: "Inter, Arial, sans-serif",
  },
  header: {
    background: "#111c35",
    color: "white",
    padding: "20px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 15,
  },
  brand: { fontSize: 23, fontWeight: 800 },
  subtitle: { color: "#aab7cf", fontSize: 12, marginTop: 5 },
  layout: { display: "flex", minHeight: "calc(100vh - 76px)" },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "#17243e",
    padding: 16,
  },
  main: { flex: 1, minWidth: 0, padding: 28 },
  card: {
    background: "white",
    border: "1px solid #e5eaf2",
    borderRadius: 13,
    padding: 20,
    boxShadow: "0 3px 12px rgba(20,40,80,0.04)",
  },
  muted: { color: "#748094", fontSize: 13 },
  button: {
    border: "none",
    borderRadius: 8,
    padding: "11px 15px",
    cursor: "pointer",
    fontWeight: 600,
  },
};

function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [scorecard, setScorecard] = useState(null);
  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [report, setReport] = useState(null);
  const [changelog, setChangelog] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [healthRes, scoreRes] = await Promise.all([
        axios.get(`${API}/health`),
        axios.get(`${API}/scorecard`),
      ]);

      setHealth(healthRes.data?.status === "healthy");

      // FastAPI returns {status: "success", data: {found, rows}}
      setScorecard(scoreRes.data?.data ?? scoreRes.data);
    } catch (err) {
      setHealth(false);
      setError(
        err.response?.data?.detail ||
          "Cannot connect to backend. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadReport = async () => {
    setReportLoading(true);

    try {
      const response = await axios.get(`${API}/report`);
      setReport(response.data?.data ?? response.data);
    } catch (err) {
      setReport({
        error:
          err.response?.data?.detail ||
          "Weekly report service is unavailable.",
      });
    } finally {
      setReportLoading(false);
    }
  };

  const loadChangelog = async () => {
    setReportLoading(true);

    try {
      const response = await axios.get(`${API}/changelog`);
      setChangelog(response.data?.data ?? response.data);
    } catch (err) {
      setChangelog({
        error:
          err.response?.data?.detail ||
          "Data changelog service is unavailable.",
      });
    } finally {
      setReportLoading(false);
    }
  };

  const changeTab = (tab) => {
    setActiveTab(tab);

    if (tab === "Weekly Report" && !report) {
      loadReport();
    }

    if (tab === "Data Audit" && !changelog) {
      loadChangelog();
    }
  };

  const askQuestion = async (event) => {
    event.preventDefault();

    if (!question.trim() || chatLoading) return;

    const userQuestion = question.trim();

    setMessages((old) => [
      ...old,
      { role: "user", text: userQuestion },
    ]);

    setQuestion("");
    setChatLoading(true);

    try {
      const response = await axios.post(`${API}/ask`, {
        question: userQuestion,
      });

      const result = response.data?.data ?? response.data;

      const answer =
        typeof result === "string"
          ? result
          : result.answer ||
            result.response ||
            JSON.stringify(result, null, 2);

      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: answer,
          sources: result.sources || [],
        },
      ]);
    } catch (err) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text:
            err.response?.data?.detail ||
            "Unable to get an answer. Please check the backend.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Correct scorecard extraction: the records are in rows.
  const data = Array.isArray(scorecard)
    ? scorecard
    : scorecard?.rows ||
      scorecard?.initiatives ||
      [];

  const totalLicensed = data.reduce(
    (sum, item) => sum + Number(item.licensed_users || 0),
    0
  );

  const totalWAU = data.reduce(
    (sum, item) => sum + Number(item.latest_wau || 0),
    0
  );

  const totalCost = data.reduce(
    (sum, item) => sum + Number(item.cost_to_date || 0),
    0
  );

  const totalBenefit = data.reduce(
    (sum, item) =>
      sum + Number(item.realised_benefit_to_date || 0),
    0
  );

  const totalMonthlyBenefit = data.reduce(
    (sum, item) =>
      sum + Number(item.avg_monthly_benefit || 0),
    0
  );

  const kpis = {
    adoption: totalLicensed
      ? (totalWAU / totalLicensed) * 100
      : 0,
    wau: totalWAU,
    roi: totalCost
      ? ((totalBenefit - totalCost) / totalCost) * 100
      : 0,
    monthlyBenefit: totalMonthlyBenefit,
  };

  const green = data.filter((x) => x.status === "Green").length;
  const amber = data.filter((x) => x.status === "Amber").length;
  const red = data.filter((x) => x.status === "Red").length;

  const metricCards = [
    {
      label: "AI Adoption",
      value: `${kpis.adoption.toFixed(2)}%`,
      icon: Users,
      color: "#2563eb",
    },
    {
      label: "Weekly Active Users",
      value: kpis.wau.toLocaleString("en-IN"),
      icon: Activity,
      color: "#0891b2",
    },
    {
      label: "Portfolio ROI",
      value: `${kpis.roi.toFixed(2)}%`,
      icon: TrendingUp,
      color: "#9333ea",
    },
    {
      label: "Monthly Benefit",
      value: money(kpis.monthlyBenefit),
      icon: IndianRupee,
      color: "#059669",
    },
  ];

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "AI Assistant", icon: MessageSquare },
    { name: "Weekly Report", icon: FileText },
    { name: "Data Audit", icon: Database },
  ];

  const chartData = data.map((item) => ({
    name: item.initiative_id,
    adoption: Number((item.adoption * 100).toFixed(1)),
  }));

  const statusStyle = (status) => {
    const colors = {
      Green: { background: "#dcfce7", color: "#166534" },
      Amber: { background: "#fef3c7", color: "#92400e" },
      Red: { background: "#fee2e2", color: "#991b1b" },
    };

    return {
      ...colors[status],
      padding: "5px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      display: "inline-block",
    };
  };

  const renderDashboard = () => (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 27 }}>
            Executive Dashboard
          </h1>
          <p style={styles.muted}>
            Enterprise AI Initiative Value Intelligence
          </p>
        </div>

        <button
          style={{
            ...styles.button,
            background: "#e8edff",
            color: "#263e9b",
          }}
          onClick={loadDashboard}
        >
          <RefreshCw size={15} style={{ verticalAlign: "middle" }} />{" "}
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            ...styles.card,
            marginBottom: 20,
            color: "#b91c1c",
          }}
        >
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {loading ? (
        <div style={styles.card}>Loading dashboard data...</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(210px,1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {metricCards.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  style={styles.card}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={styles.muted}>
                      {metric.label}
                    </span>
                    <Icon color={metric.color} size={22} />
                  </div>

                  <div
                    style={{
                      fontSize: 25,
                      fontWeight: 800,
                      marginTop: 15,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {metric.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(160px,1fr))",
              gap: 15,
              marginBottom: 24,
            }}
          >
            {[
              ["Total Initiatives", data.length, "#334155"],
              ["Green", green, "#15803d"],
              ["Amber", amber, "#b45309"],
              ["Red", red, "#b91c1c"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                style={{
                  ...styles.card,
                  borderLeft: `5px solid ${color}`,
                }}
              >
                <div style={styles.muted}>{label}</div>
                <div
                  style={{
                    fontSize: 27,
                    fontWeight: 800,
                    marginTop: 8,
                    color,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(300px,1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <div style={styles.card}>
              <h3>Initiative Adoption</h3>
              <p style={styles.muted}>
                Weekly adoption percentage by initiative
              </p>

              <div style={{ width: "100%", height: 280 }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis unit="%" />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar
                        dataKey="adoption"
                        fill="#4361ee"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No initiative data available.</p>
                )}
              </div>
            </div>

            <div style={styles.card}>
              <h3>Portfolio Health</h3>
              <p style={styles.muted}>
                Current initiative status distribution
              </p>

              {[
                ["Green", green, "#16a34a"],
                ["Amber", amber, "#d97706"],
                ["Red", red, "#dc2626"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ marginTop: 23 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 7,
                    }}
                  >
                    <strong>{label}</strong>
                    <strong>{value}</strong>
                  </div>

                  <div
                    style={{
                      height: 12,
                      background: "#edf0f5",
                      borderRadius: 20,
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          data.length
                            ? (value / data.length) * 100
                            : 0
                        }%`,
                        height: "100%",
                        background: color,
                        borderRadius: 20,
                      }}
                    />
                  </div>
                </div>
              ))}

              <p style={{ ...styles.muted, marginTop: 25 }}>
                {amber + red} initiatives require management attention.
              </p>
            </div>
          </div>

          <div style={styles.card}>
            <h3>Initiative Scorecard</h3>
            <p style={styles.muted}>
              Detailed performance and financial indicators
            </p>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 760,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {[
                      "Initiative",
                      "Adoption",
                      "WAU",
                      "ROI",
                      "Monthly Benefit",
                      "Status",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 13,
                          textAlign: "left",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.initiative_id}
                      style={{
                        borderBottom: "1px solid #e5eaf2",
                      }}
                    >
                      <td style={{ padding: 13 }}>
                        <strong>{item.name}</strong>
                        <div style={styles.muted}>
                          {item.initiative_id}
                        </div>
                      </td>
                      <td style={{ padding: 13 }}>
                        {percentage(item.adoption)}
                      </td>
                      <td style={{ padding: 13 }}>
                        {item.latest_wau}
                      </td>
                      <td style={{ padding: 13 }}>
                        {percentage(item.roi)}
                      </td>
                      <td style={{ padding: 13 }}>
                        {money(item.avg_monthly_benefit)}
                      </td>
                      <td style={{ padding: 13 }}>
                        <span style={statusStyle(item.status)}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data.length === 0 && (
                <p>No initiative records returned by the API.</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const renderAssistant = () => (
    <div>
      <h1> Nimbus AI Assistant</h1>
      <p style={styles.muted}>
        Ask questions about enterprise AI initiatives, ROI,
        adoption, risks and charter evidence.
      </p>

      <div
        style={{
          ...styles.card,
          minHeight: 350,
          marginTop: 20,
          marginBottom: 15,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 45 }}>
            <Bot size={42} color="#4361ee" />
            <h3>How can I help you?</h3>
            <p style={styles.muted}>
              Try asking: Which initiatives are at risk?
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent:
                message.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 15,
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: 15,
                borderRadius: 12,
                background:
                  message.role === "user" ? "#e5edff" : "#f1f5f9",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                overflowWrap: "anywhere",
              }}
            >
              <strong>
                {message.role === "user" ? "You" : "Nimbus AI"}
              </strong>
              <div style={{ marginTop: 6 }}>{message.text}</div>
            </div>
          </div>
        ))}

        {chatLoading && (
          <p style={styles.muted}>Nimbus AI is thinking...</p>
        )}
      </div>

      <form
        onSubmit={askQuestion}
        style={{ display: "flex", gap: 10 }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Nimbus AI a question..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: 14,
            border: "1px solid #d5dce7",
            borderRadius: 9,
          }}
        />

        <button
          type="submit"
          disabled={chatLoading || !question.trim()}
          style={{
            ...styles.button,
            background: "#3156d3",
            color: "white",
          }}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );

  const renderReport = () => (
    <div>
      <h1>Weekly Executive Report</h1>
      <p style={styles.muted}>
        Executive summary generated from the governed scorecard.
      </p>

      <button
        onClick={loadReport}
        style={{
          ...styles.button,
          background: "#e8edff",
          color: "#263e9b",
          margin: "15px 0",
        }}
      >
        <RefreshCw size={15} /> Refresh Report
      </button>

      {reportLoading && <p>Loading report...</p>}

      {report?.error && (
        <div style={styles.card}>{report.error}</div>
      )}

      {report && !report.error && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <div style={styles.muted}>Initiatives evaluated</div>
              <h2>{report.initiatives_evaluated ?? "—"}</h2>
            </div>
            <div>
              <div style={styles.muted}>Green</div>
              <h2 style={{ color: "#15803d" }}>
                {report.green ?? "—"}
              </h2>
            </div>
            <div>
              <div style={styles.muted}>Amber</div>
              <h2 style={{ color: "#b45309" }}>
                {report.amber ?? "—"}
              </h2>
            </div>
            <div>
              <div style={styles.muted}>Red</div>
              <h2 style={{ color: "#b91c1c" }}>
                {report.red ?? "—"}
              </h2>
            </div>
          </div>

          <h3>Report Details</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontFamily: "inherit",
              lineHeight: 1.7,
              background: "#f8fafc",
              padding: 18,
              borderRadius: 8,
            }}
          >
            {report.report || "No report content available."}
          </pre>

          {report.file && (
            <p style={styles.muted}>
              Saved report: {report.file}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderAudit = () => (
    <div>
      <h1>Data Audit</h1>
      <p style={styles.muted}>
        Data cleaning and standardization changelog.
      </p>

      <button
        onClick={loadChangelog}
        style={{
          ...styles.button,
          background: "#e8edff",
          color: "#263e9b",
          margin: "15px 0",
        }}
      >
        <RefreshCw size={15} /> Refresh Changelog
      </button>

      {reportLoading && <p>Loading changelog...</p>}

      {changelog?.error && (
        <div style={styles.card}>{changelog.error}</div>
      )}

      {changelog && !changelog.error && (
        <div style={styles.card}>
          {changelog.available ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontFamily: "inherit",
                lineHeight: 1.8,
              }}
            >
              {changelog.content}
            </pre>
          ) : (
            <p>{changelog.message || "Changelog is not available."}</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>NIMBUS AI</div>
          <div style={styles.subtitle}>
            Enterprise AI Value Intelligence Platform
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
          }}
        >
          {health ? (
            <CheckCircle2 color="#4ade80" size={18} />
          ) : (
            <AlertCircle color="#f87171" size={18} />
          )}
          API {health ? "Operational" : "Disconnected"}
        </div>
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div
            style={{
              color: "#8798b8",
              fontSize: 11,
              fontWeight: 700,
              padding: "10px 12px",
              letterSpacing: 1,
            }}
          >
            WORKSPACE
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.name;

            return (
              <button
                key={item.name}
                onClick={() => changeTab(item.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "13px 12px",
                  marginBottom: 6,
                  textAlign: "left",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selected ? "#30466e" : "transparent",
                  color: selected ? "white" : "#b6c4dc",
                  fontWeight: selected ? 700 : 500,
                }}
              >
                <Icon size={18} />
                {item.name}
              </button>
            );
          })}

          <div
            style={{
              color: "#8293b1",
              fontSize: 11,
              margin: "30px 12px 8px",
            }}
          >
            SYSTEM STATUS
          </div>

          <div
            style={{
              color: "#c4d0e3",
              fontSize: 12,
              padding: "8px 12px",
            }}
          >
            <div>Backend: {health ? "Online" : "Offline"}</div>
            <div style={{ marginTop: 7 }}>
              Initiatives: {data.length}
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          {activeTab === "Dashboard" && renderDashboard()}
          {activeTab === "AI Assistant" && renderAssistant()}
          {activeTab === "Weekly Report" && renderReport()}
          {activeTab === "Data Audit" && renderAudit()}
        </main>
      </div>

      <footer
        style={{
          background: "#111c35",
          color: "#aab7cf",
          textAlign: "center",
          padding: 14,
          fontSize: 12,
        }}
      >
        Nimbus AI | HCLTech Future Ready AI Engineer Hackathon
      </footer>
    </div>
  );
}

export default App;
