// frontend/src/components/teacher/TeacherDashboard.tsx
import { useState, useEffect, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiHome, FiShield, FiBook, FiEdit, FiLogOut, FiSun, FiMoon,FiAlertCircle,FiCheckCircle, FiTrendingUp } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import TeacherResolvedTickets from "../components/teacher/TeacherResolvedTickets"; 
import TeacherEscalatedTickets from "../components/teacher/TeacherEscalatedTickets";
import TeacherHome from "../components/teacher/TeacherHome";
import TeacherManageRoles from "../components/teacher/ManageRoles";
import TeacherCourses from "../components/teacher/TeacherCourses";
import TeacherExams from "../components/teacher/TeacherExams";
import ChangePassword from "../components/teacher/ChangePassword";
import StudentsView from "../components/teacher/StudentsView";
import TeacherEvaluatorCredibility from "../components/teacher/TeacherEvaluatorCredibility";
import { PiStudent } from "react-icons/pi";
import type { IconType } from "react-icons";

const PORT = import.meta.env.VITE_BACKEND_PORT || 5000;

// Define both light and dark mode palettes
const lightPalette = {
  "bg-primary": "#FFFBF6",
  "bg-secondary": "#FFFAF2",
  "sidebar-bg": "#E6E6FA",
  "text-dark": "#4B0082",
  "text-muted": "#A9A9A9",
  "text-sidebar-dark": "#4B0082",
  "border-soft": "#F0E6EF",
  "white": "#FFFFFF",
  "shadow-medium": "rgba(128, 0, 128, 0.08)",
  "shadow-strong": "rgba(128, 0, 128, 0.15)", // Added for stronger shadow in light mode
};

const darkPalette = {
  "bg-primary": "#1A202C", // Dark background
  "bg-secondary": "#2D3748", // Slightly lighter dark background for cards/popups
  "sidebar-bg": "#2A385B", // Dark bluish shade for sidebar
  "text-dark": "#E2E8F0", // Light text for contrast
  "text-muted": "#A0AEC0", // Muted light text
  "text-sidebar-dark": "#E2E8F0", // Light text for sidebar
  "border-soft": "#4A5568", // Darker border
  "white": "#1A202C", // This might need to be adjusted depending on usage, maybe #CBD5E0
  "shadow-medium": "rgba(0, 0, 0, 0.4)", // Darker shadow for dark mode
  "shadow-strong": "rgba(0, 0, 0, 0.6)", // Stronger dark shadow
};

const ProfileSVG = ({ currentColor }: { currentColor: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: currentColor }}
  >
    <path d="M18 20a6 6 0 0 0-12 0" />
    <circle cx="12" cy="10" r="4" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const TeacherDashboard = () => {
  const [activePage, setActivePage] = useState("home");
  const [showSidebar, setShowSidebar] = useState(true);
  const [darkMode, setDarkMode] = useState(false); // State for dark mode
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", role: "" });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Determine which palette to use based on darkMode state
  const currentPalette = darkMode ? darkPalette : lightPalette;

  useEffect(() => {
    // Check local storage for dark mode preference
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }

    fetch(`http://localhost:${PORT}/api/dashboard/profile`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(res => res.json())
      .then(data => setProfile(data))
      .catch(() => { });
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage.setItem("darkMode", JSON.stringify(newMode)); // Save preference
      return newMode;
    });
  };
  const navigate = useNavigate();

  const confirmLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const pages: Record<string, JSX.Element> = {
    home: <TeacherHome />,
    roles: <TeacherManageRoles />,
    courses: <TeacherCourses />,
    exams: <TeacherExams />,
    Students:<StudentsView/>,
    credibility: <TeacherEvaluatorCredibility darkMode={darkMode} />,
    tickets: <TeacherEscalatedTickets />,
     resolved: <TeacherResolvedTickets />,
  };

  const icons: Record<string, IconType> = {
    home: FiHome,
    roles: FiShield,
    courses: FiBook,
    exams: FiEdit,
    Students:PiStudent,
    credibility: FiTrendingUp,
     tickets: FiAlertCircle,
     resolved: FiCheckCircle,
  };

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: currentPalette["bg-primary"] }}>
      {/* Sidebar */}
      <motion.div
        className={`flex flex-col justify-between py-6 px-4 rounded-r-3xl shadow-xl z-20 transition-all duration-300 ${showSidebar ? "w-64" : "w-20"
          }`}
        style={{
          backgroundColor: currentPalette["sidebar-bg"],
          boxShadow: `8px 0 30px ${currentPalette["shadow-medium"]}`,
        }}
      >
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="mb-6 p-2 border-2 border-transparent rounded-full"
          style={{ borderColor: currentPalette["text-dark"] }}
        >
          <FiMenu className="text-2xl" style={{ color: currentPalette["text-sidebar-dark"] }} />
        </button>
        <div className="flex-1 flex flex-col items-center">
          <h2
            className={`font-bold mb-10 mt-4 transition-all duration-300 ${showSidebar ? "text-2xl" : "text-lg"
              }`}
            style={{ color: currentPalette["text-sidebar-dark"] }}
          >
            {showSidebar ? "Teacher Panel" : "Tea"}
          </h2>
          <ul className="space-y-3 w-full">
            {Object.entries(pages).map(([key]) => {
              const Icon = icons[key];
              return (
                <motion.li
                  key={key}
                  onClick={() => setActivePage(key)}
                  className={`cursor-pointer flex items-center px-4 py-2 rounded-lg relative transition-all`}
                  style={{
                    color: currentPalette["text-sidebar-dark"],
                    // Background for active item should still be sidebar-bg, but its shadow will differentiate it
                    backgroundColor: activePage === key ? currentPalette["sidebar-bg"] : "transparent",
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  {activePage === key && (
                    <motion.div
                      layoutId="activePage"
                      className="absolute inset-0 rounded-lg -z-10"
                      style={{
                        backgroundColor: currentPalette["sidebar-bg"],
                        boxShadow: `0 0 15px ${currentPalette["shadow-strong"]}`, // Stronger shadow for active item
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className={`transition-all duration-300 ${showSidebar ? "mr-3 text-xl" : "text-3xl"}`} />
                  {showSidebar && (
                    <span className="font-medium whitespace-nowrap">
                      {key === "roles" ? "Manage Roles" : key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </div>
        <motion.button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center justify-center gap-2 hover:opacity-80 transition-all duration-200"
          style={{ color: currentPalette["text-sidebar-dark"] }}
          whileHover={{ scale: 1.03, x: 5 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiLogOut className={`${showSidebar ? "mr-3 text-xl" : "text-3xl"}`} />
          {showSidebar && <span className="font-medium whitespace-nowrap" onClick={() => setShowLogoutConfirm(true)}
          >Logout</span>}
        </motion.button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-y-auto flex justify-center items-start p-4 z-10">
        <div className="absolute top-4 right-6 z-20">
          <button
            onClick={() => setShowProfile((p) => !p)}
            className="p-2 rounded-full border-2 border-transparent shadow"
            style={{
              backgroundColor: currentPalette["white"],
              borderColor: currentPalette["border-soft"],
              boxShadow: `0 2px 14px 0 ${currentPalette["shadow-medium"]}`,
            }}
            title="Profile"
          >
            <ProfileSVG currentColor={currentPalette["text-dark"]} />
          </button>
          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-3 w-80 p-4 rounded-b-3xl shadow-lg z-10"
                style={{
                  backgroundColor: currentPalette["bg-secondary"],
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  boxShadow: `0 4px 14px ${currentPalette["shadow-medium"]}`,
                  color: currentPalette["text-dark"],
                }}
              >
                <h2 className="text-xl font-bold mb-4">Profile Info</h2>
                <div className="space-y-2 mb-2">
                  <p><strong>Name:</strong> {profile.name}</p>
                  <p><strong>Email:</strong> {profile.email}</p>
                  <p><strong>Role:</strong> {profile.role}</p>
                  <motion.button
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full text-left text-sm mt-2 hover:underline"
                    style={{ color: currentPalette["text-dark"] }}
                  >
                    Change Password
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="rounded-3xl shadow-2xl w-full max-w-6xl h-auto mt-20 mb-10 mx-6 px-8 py-6 flex flex-col items-start justify-start"
          style={{
            minHeight: "calc(100vh - 120px)",
            backgroundColor: currentPalette["bg-primary"],
            boxShadow: `0 10px 40px ${currentPalette["shadow-medium"]}`,
          }}
        >
          <div className="w-full" style={{ color: currentPalette["text-dark"] }}>{pages[activePage]}</div>
        </div>

        <motion.button
          onClick={toggleDarkMode}
          className="fixed bottom-6 right-6 p-3 rounded-full shadow-lg z-50"
          style={{
            backgroundColor: currentPalette["sidebar-bg"],
            color: currentPalette["text-sidebar-dark"],
            boxShadow: `0 4px 15px ${currentPalette["shadow-medium"]}`,
          }}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          {darkMode ? <FiSun className="text-2xl" /> : <FiMoon className="text-2xl" />}
        </motion.button>
      </div>

      {showPasswordModal && <ChangePassword onClose={() => setShowPasswordModal(false)} />}

      {/* Logout Confirm Dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              // These styles for the modal itself need to be dynamic for dark mode
              style={{
                backgroundColor: currentPalette["bg-secondary"],
                color: currentPalette["text-dark"],
                boxShadow: `0 8px 30px ${currentPalette["shadow-strong"]}`,
              }}
              className="rounded-2xl px-8 py-6 shadow-xl text-center"
            >
              <h2 className="text-xl font-bold mb-4">Are you sure you want to logout?</h2>
              <div className="flex justify-center gap-6">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  // You might want to make these button colors dynamic too, or stick to a neutral grey
                  className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-medium"
                  style={{ color: currentPalette["text-dark"] }} // Keep text readable
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

export default TeacherDashboard;