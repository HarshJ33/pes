import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiMoon, FiSun } from 'react-icons/fi';


const PORT = import.meta.env.VITE_BACKEND_PORT || 5000;

type Tab = 'home' | 'course' | 'batch'| 'role';
type Course = {
  _id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
};

const lightPalette = {
    'bg-primary': '#FFFBF6',         
    'bg-secondary': '#FFFAF2',       
    'accent-bright-yellow': '#FFD700',
    'accent-light-yellow': '#FFECB3', 
    'accent-pink': '#FF8DA1',        
    'accent-lilac': '#C8A2C8',       
    'accent-purple': '#800080',      
    'accent-light-purple': '#DDA0DD',
    'sidebar-bg': '#E6E6FA',         
    'text-dark': '#4B0082',          
    'text-muted': '#A9A9A9',         
    'text-sidebar-dark': '#4B0082',  
    'border-soft': '#F0E6EF',        
    'shadow-light': 'rgba(128, 0, 128, 0.04)',  
    'shadow-medium': 'rgba(128, 0, 128, 0.08)', 
    'shadow-strong': 'rgba(128, 0, 128, 0.15)', 
};

// Dark mode specific colors
const darkPalette = {
    'bg-primary': '#1A1A2E',
    'bg-secondary': '#16213E',
    'accent-bright-yellow': '#FFEB3B',
    'accent-light-yellow': '#FFEE58',
    'accent-pink': '#EC407A',
    'accent-lilac': '#9C27B0',
    'accent-purple': '#6A1B9A',
    'accent-light-purple': '#8E24AA',
    'sidebar-bg': '#0F3460',
    'text-dark': '#E0E0E0',
    'text-muted': '#B0BEC5',
    'text-sidebar-dark': '#E0E0E0',
    'border-soft': '#3F51B5',
    'shadow-light': 'rgba(0, 0, 0, 0.2)',
    'shadow-medium': 'rgba(0, 0, 0, 0.4)',
    'shadow-strong': 'rgba(0, 0, 0, 0.6)',
};

type Palette = typeof lightPalette;

const getColors = (isDarkMode: boolean): Palette => isDarkMode ? darkPalette : lightPalette;

const Toast = ({ message, type, onClose, currentPalette }: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void;
  currentPalette: Palette;
}) => {
    const bgColor = type === 'success' ? currentPalette['accent-lilac'] : currentPalette['accent-pink'];
    const textColor = 'white';

    return (
        <div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-xl flex items-center space-x-3 z-50 min-w-[250px] justify-between transition-all duration-300"
            style={{ backgroundColor: bgColor, color: textColor }}
        >
            <span className="text-2xl">{type === 'success' ? '✅' : '❌'}</span>
            <span className="text-lg font-medium flex-grow text-center">{message}</span>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors duration-200">
                <span className="text-xl">✖️</span>
            </button>
        </div>
    );
};

const Modal = ({ 
  show, 
  onClose, 
  onConfirm, 
  title, 
  children,
  currentPalette 
}: { 
  show: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  children: React.ReactNode,
  currentPalette: Palette 
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
                className="rounded-2xl p-6 w-full max-w-md m-4 shadow-xl text-center transition-all duration-300"
                style={{
                    backgroundColor: currentPalette['bg-primary'],
                    boxShadow: `0 8px 25px ${currentPalette['shadow-strong']}`,
                }}
            >
                <h3 className="text-xl font-bold mb-4" style={{ color: currentPalette['text-dark'] }}>
                    {title}
                </h3>
                <div className="mb-6" style={{ color: currentPalette['text-muted'] }}>
                    {children}
                </div>
                <div className="flex justify-around gap-4">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors duration-200 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 rounded-lg font-semibold shadow-md transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{
                            backgroundColor: currentPalette['accent-purple'],
                            color: 'white',
                            boxShadow: `0 4px 15px ${currentPalette['accent-purple']}40`,
                            '--tw-ring-color': currentPalette['accent-purple'] + '50',
                        } as React.CSSProperties & Record<string, any>}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const Card = ({ 
  title, 
  children,
  currentPalette 
}: { 
  title: string, 
  children: React.ReactNode,
  currentPalette: Palette 
}) => {
  const cardStyles = {
    backgroundColor: currentPalette['bg-secondary'],
    borderColor: currentPalette['border-soft'],
    boxShadow: `0 8px 20px ${currentPalette['shadow-medium']}`,
  };

  return (
    <div 
      className="rounded-xl p-6 space-y-4 border w-full" 
      style={cardStyles}
    >
      <h2 className="text-2xl font-bold mb-6" style={{ color: currentPalette['text-dark'] }}>
        {title}
      </h2>
      {children}
    </div>
  );
};

const Input = ({ 
  currentPalette, 
  ...props 
}: { 
  currentPalette: Palette 
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 transition text-base font-sans"
    style={{
      borderColor: currentPalette['border-soft'],
      backgroundColor: currentPalette['bg-primary'],
      color: currentPalette['text-dark'],
      boxShadow: `0 2px 8px ${currentPalette['shadow-light']}`,
      '--tw-ring-color': currentPalette['accent-lilac'] + '70',
    } as React.CSSProperties & Record<string, any>}
  />
);

const Select = ({ 
  currentPalette, 
  ...props 
}: { 
  currentPalette: Palette 
} & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 transition text-base font-sans"
    style={{
      borderColor: currentPalette['border-soft'],
      backgroundColor: currentPalette['bg-primary'],
      color: currentPalette['text-dark'],
      boxShadow: `0 2px 8px ${currentPalette['shadow-light']}`,
      '--tw-ring-color': currentPalette['accent-lilac'] + '70',
    } as React.CSSProperties & Record<string, any>}
  />
);

const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary',
  currentPalette 
}: { 
  children: React.ReactNode, 
  onClick?: (e: any) => void, 
  type?: 'button' | 'submit' | 'reset', 
  variant?: 'primary' | 'danger' | 'light-contrast',
  currentPalette: Palette
}) => {
  const getButtonStyles = (colorKey: keyof Palette, textColorKey: 'white' | 'text-dark' = 'text-dark') => {
    const bgColor = currentPalette[colorKey];
    let textColor = textColorKey === 'white' ? 'white' : currentPalette[textColorKey];

    if (colorKey === 'accent-purple' || colorKey === 'accent-pink') {
      textColor = 'white';
    }
    
    return {
      backgroundColor: bgColor,
      color: textColor,
      boxShadow: `0 4px 15px ${currentPalette[colorKey]}40`,
      '--tw-ring-color': currentPalette[colorKey] + '50',
    };
  };

  let buttonPaletteKey: keyof Palette;
  let textColorKey: 'white' | 'text-dark' = 'white';

  if (variant === 'primary') {
    buttonPaletteKey = 'accent-purple';
    textColorKey = 'white';
  } else if (variant === 'danger') {
    buttonPaletteKey = 'accent-pink';
    textColorKey = 'white';
  } else if (variant === 'light-contrast') {
    buttonPaletteKey = 'accent-lilac';
    textColorKey = 'text-dark';
  } else {
    buttonPaletteKey = 'accent-purple';
  }

  const commonButtonClasses = `
    px-6 py-2 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md active:scale-95 transform
    focus:outline-none focus:ring-2 focus:ring-offset-2
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      className={commonButtonClasses}
      style={getButtonStyles(buttonPaletteKey, textColorKey)}
    >
      {children}
    </button>
  );
};

const AdminDashboard = () => {  
  const navigate = useNavigate();
  const [token] = useState(localStorage.getItem('token'));

  // UI State
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  
  // Data State
  const [counts, setCounts] = useState({ teachers: 0, courses: 0, students: 0 });
  const [profileData, setProfileData] = useState({ name: "", email: "", role: "" });
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batchName, setBatchName] = useState('');
  const [batchCourseCode, setBatchCourseCode] = useState('');
  const [batchToDelete, setBatchToDelete] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [batchInstructor, setBatchInstructor] = useState('');
  const [allUsers, setAllUsers] = useState<{ _id: string | number | readonly string[] | undefined; role: string; email: string; name: string }[]>([]);

  // Form & Message State
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [courseIdToDelete, setCourseIdToDelete] = useState('');
  const [roleEmail, setRoleEmail] = useState("");
  const [roleType, setRoleType] = useState(""); // Default to empty
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const currentPalette = getColors(darkMode); // Get current palette based on dark mode state

  // Apply dark mode on initial load and when it changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const ProfileSVG = () => (
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
        className="text-gray-700 dark:text-gray-200"
        >
        <path d="M18 20a6 6 0 0 0-12 0" />
        <circle cx="12" cy="10" r="4" />
        <circle cx="12" cy="12" r="10" />
    </svg>
    );
    
  // Generic data fetching function
  const fetchData = async (url: string, setter: Function, errorMessage: string) => {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setter(res.data);
    } catch (error) {
      console.error(errorMessage, error);
    }
  };

  // Fetch initial data for the dashboard
  useEffect(() => {
    if (!token) {
        navigate('/'); // Redirect to login
        return;
    }
    fetchData(`http://localhost:${PORT}/api/dashboard/profile`, setProfileData, 'Failed to fetch profile');
    fetchData(`http://localhost:${PORT}/api/dashboard/counts`, setCounts, 'Failed to fetch counts');
    fetchData(`http://localhost:${PORT}/api/admin/users`, setAllUsers, 'Failed to fetch users');
  }, [token, navigate]);
  
  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'course') {
        fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error fetching courses');
    }
    if (activeTab === 'batch') {
        fetchData(`http://localhost:${PORT}/api/admin/batches`, setBatches, 'Error fetching batches');
        fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error fetching courses for batches');
        fetchData(`http://localhost:${PORT}/api/admin/users`, setAllUsers, 'Failed to fetch instructors for batches');
    }
    if(activeTab === 'role') {
        fetchData(`http://localhost:${PORT}/api/admin/users`, setAllUsers, 'Failed to fetch users');
    }
  }, [activeTab]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`http://localhost:${PORT}/api/admin/courses`, { name: courseName, code: courseCode, startDate, endDate }, { headers: { Authorization: `Bearer ${token}` } });
      showToast('Course added successfully');
      setCourseName('');
      setCourseCode('');
      setStartDate('');
      setEndDate('');
      fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error refetching courses');
    } catch (error) {
      console.error(error);
      showToast('Failed to add course', 'error');
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseIdToDelete) {
        showToast("Please select a course to delete.", 'error');
        return;
    }
    try {
      await axios.delete(`http://localhost:${PORT}/api/admin/${courseIdToDelete}`, { headers: { Authorization: `Bearer ${token}` } });
      showToast('Course deleted');
      setCourseIdToDelete('');
      fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error refetching courses');
    } catch (error) {
      console.error(error);
      showToast('Failed to delete course', 'error');
    }
  };

  const handleAddBatch = async () => {
    try {
      const courseRes = await axios.get(`http://localhost:${PORT}/api/admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const course = courseRes.data.find((c: any) => c.code === batchCourseCode);

      if (!course) {
        showToast('Course not found', 'error');
        return;
      }

      if (!batchInstructor) {
        showToast('Please select an instructor', 'error');
        return;
      }
      console.log({
        batchName: batchName,
        courseId: course._id,
        instructorId: batchInstructor,
        students: []
      });
      await axios.post(
        `http://localhost:${PORT}/api/admin/create-batch-with-names`,
        { batchName: batchName, courseId: course._id, instructorId: batchInstructor, students: [] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast('Batch added successfully');
      setBatchName('');
      setBatchCourseCode('');
      setBatchInstructor(''); 
      fetchData(`http://localhost:${PORT}/api/admin/batches`, setBatches, 'Error fetching batches');
      fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error fetching courses for batches');
    } catch (err) {
      console.error(err);
      showToast('Failed to add batch', 'error');
    }
  };

  const handleDeleteBatch = async () => {
    try {
      await axios.delete(`http://localhost:${PORT}/api/admin/batches/${batchToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast('Batch deleted successfully');
      setBatchToDelete('');
      fetchData(`http://localhost:${PORT}/api/admin/batches`, setBatches, 'Error fetching batches');
      fetchData(`http://localhost:${PORT}/api/admin/courses`, setCourses, 'Error fetching courses for batches');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete batch', 'error');
    }
  };

  const handleRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleEmail || !roleType) {
      showToast('Please select a user and a role', 'error');
      return;
    }
    try {
        await axios.post(`http://localhost:${PORT}/api/admin/update-role`, { email: roleEmail, role: roleType }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        showToast('Role updated successfully');
        fetchData(`http://localhost:${PORT}/api/admin/users`, setAllUsers, 'Failed to refetch users');
        setRoleEmail('');
        setRoleType('');
    } catch(error) {
        console.error("Failed to update role", error);
        showToast("Failed to update role", 'error');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const SidebarLink = useMemo(() => ({ tabName, icon: IconSVG, text }: { tabName: Tab, icon: React.ReactNode, text: string }) => (
    <li
      key={tabName}
      onClick={() => {
        if (activeTab !== tabName) setActiveTab(tabName);
      }}
      className={`cursor-pointer flex items-center px-4 py-2 rounded-lg transition-all duration-200 transform
          ${activeTab === tabName ? 'scale-100 relative' : 'hover:scale-[1.02]'}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      `}
      style={{
        color: currentPalette['text-sidebar-dark'],
        '--tw-ring-color': currentPalette['accent-lilac'] + '70',
      } as React.CSSProperties & Record<string, any>}
    >
      {activeTab === tabName && (
        <div
          className="absolute inset-0 rounded-lg -z-10 transition-all duration-300"
          style={{
            backgroundColor: currentPalette['accent-light-purple'] + '20',
            boxShadow: `0 0 15px ${currentPalette['accent-light-purple']}40`,
          }}
        />
      )}
      <span className={`transition-all duration-300 ${showSidebar ? 'mr-3 text-xl' : 'text-3xl'}`}>
        {IconSVG}
      </span>
      {showSidebar && <span className="font-medium whitespace-nowrap">{text}</span>}
    </li>
  ), [activeTab, currentPalette, showSidebar]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        const cardBaseStyle = {
            borderRadius: '1.5rem',
            padding: '1.5rem',
            textAlign: 'center' as const,
            boxShadow: `0 6px 16px ${currentPalette['shadow-light']}`,
            color: currentPalette['text-dark'],
            backgroundImage: darkMode
                ? 'linear-gradient(135deg, #3b3f99, #5a63c2)'
                : 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
        };

        const hoverStyle = {
            transform: 'scale(1.04)',
            filter: 'brightness(1.08)',
            transition: 'transform 0.2s ease, filter 0.2s ease',
            cursor: 'pointer',
        };

        return (
          <div className="flex flex-col items-center justify-start w-full h-full pt-10 pb-4">
            <h1
                className="text-4xl font-bold text-center mb-6"
                style={{ color: currentPalette['text-dark'] }}
            >
                <span>Hello, {profileData?.name} 👋</span>
                <span className="block">Welcome to Admin Dashboard</span>
            </h1>

            <div className="mt-10 flex flex-col md:flex-row justify-center gap-6 w-full max-w-2xl">
              {[
                { label: 'Manage Courses', tab: 'course' },
                { label: 'Manage Batches', tab: 'batch' },
                { label: 'Manage Roles', tab: 'role' },
                
              ].map((btn) => (
                <button
                  key={btn.tab}
                  onClick={() => {
                    if (activeTab !== btn.tab) setActiveTab(btn.tab as Tab);
                  }}
                  className="px-10 py-4 text-lg rounded-3xl shadow-md transition-all transform active:scale-95 hover:scale-105 hover:brightness-105"
                  style={{
                    backgroundColor: currentPalette['accent-lilac'],
                    color: currentPalette['text-dark'],
                    boxShadow: `0 4px 12px ${currentPalette['shadow-light']}`,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full max-w-4xl">
                {[
                { icon: '🧑‍🏫', label: 'Teachers', value: counts.teachers, tab: 'role' },
                { icon: '📘', label: 'Courses', value: counts.courses, tab: 'course' },
                { icon: '🎓', label: 'Students', value: counts.students, tab: 'batch' },
                ].map((card) => (
                <div
                    key={card.label}
                    onClick={() => {
                        if (activeTab !== card.tab) setActiveTab(card.tab as Tab);
                        }}
                    style={cardBaseStyle}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
                    onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, {
                        transform: '',
                        filter: '',
                    });
                    }}
                >
                    <span className="text-3xl mb-2 block">{card.icon}</span>
                    <h2 className="text-lg font-semibold">{card.label}</h2>
                    <p className="text-sm">{card.value}</p>
                </div>
                ))}
            </div>
          </div>
        );

      case 'role':
        return (
            <Card title="Role Manager" currentPalette={currentPalette}>
                <p className="text-base mb-6" style={{ color: currentPalette['text-muted'] }}>Update the role of a user by selecting their email and assigning a new role.</p>
                <form name="roleUpdateForm" id="roleUpdateForm" onSubmit={handleRoleUpdate} className="space-y-4 max-w-lg">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>User</label>
                        <Select 
                          value={roleEmail} 
                          onChange={(e) => setRoleEmail(e.target.value)} 
                          required
                          currentPalette={currentPalette}
                        >
                            <option value="">Select User</option>
                            <optgroup label="Admins">
                                {allUsers
                                .filter(user => user.role === 'admin')
                                .map(user => (
                                    <option key={user.email} value={user.email}>
                                    {user.name} ({user.email})
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Teachers">
                                {allUsers
                                .filter(user => user.role === 'teacher')
                                .map(user => (
                                    <option key={user.email} value={user.email}>
                                    {user.name} ({user.email})
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Students">
                                {allUsers
                                .filter(user => user.role === 'student')
                                .map(user => (
                                    <option key={user.email} value={user.email}>
                                    {user.name} ({user.email})
                                    </option>
                                ))}
                            </optgroup>
                        </Select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>New Role</label>
                        <Select 
                          name="selectRole" 
                          id="selectRole" 
                          value={roleType} 
                          onChange={(e) => setRoleType(e.target.value)} 
                          required
                          currentPalette={currentPalette}
                        >
                            <option value="">Select Role</option>
                            <option value="admin">Admin</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>

                        </Select>
                    </div>
                    <div className="pt-2">
                        <Button 
                          type="submit" 
                          variant="light-contrast"
                          currentPalette={currentPalette}
                        >
                          Update Role
                        </Button>
                    </div>
                </form>
            </Card>
        );

      case 'course':
        return (
            <div className="grid grid-cols-1 gap-8 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                <Card title="Manage Courses" currentPalette={currentPalette}>
                    <form id="add-course-form" name="add-course-form" onSubmit={handleAddCourse} className="space-y-4 mb-8">
                        <h3 className="font-semibold text-lg" style={{ color: currentPalette['text-dark'] }}>Add New Course</h3>
                        <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }} htmlFor="courseName">Course Name</label>
                        <Input 
                          id ="courseName"
                          name = "courseName"
                          currentPalette={currentPalette}
                          type="text" 
                          value={courseName} 
                          onChange={(e) => setCourseName(e.target.value)} 
                          placeholder="e.g., Introduction to React" 
                          required 
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }} htmlFor="courseCode">Course Code</label>
                        <Input 
                          id="courseCode"
                          name="courseCode"
                          currentPalette={currentPalette}
                          type="text" 
                          value={courseCode} 
                          onChange={(e) => setCourseCode(e.target.value)} 
                          placeholder="e.g., CS101" 
                          required 
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }} htmlFor="startDate">Start Date</label>
                        <Input 
                          id="startDate"
                          name="startDate"
                          currentPalette={currentPalette}
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)} 
                          required 
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }} htmlFor="endDate">End Date</label>
                        <Input 
                          id="endDate"
                          name="endDate"
                          currentPalette={currentPalette}
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)} 
                          required 
                        />
                        </div>
                        <div className="pt-2">
                        <Button 
                          type="submit" 
                          variant="light-contrast"
                          currentPalette={currentPalette}
                        >
                          Add Course
                        </Button>
                        </div>
                    </form>
                </Card>

                <Card title="Remove Course" currentPalette={currentPalette}>
                <div className="space-y-4">
                    <Select 
                      id="courseIdToDelete"
                      name="courseIdToDelete"
                      value={courseIdToDelete} 
                      onChange={(e) => setCourseIdToDelete(e.target.value)} 
                      required
                      currentPalette={currentPalette}
                    >
                    <option value="">Select course to delete</option>
                    {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                        {course.name} ({course.code})
                        </option>
                    ))}
                    </Select>
                    <Button 
                      onClick={handleDeleteCourse} 
                      variant="danger"
                      currentPalette={currentPalette}
                    >
                      Remove Course
                    </Button>
                </div>
                </Card>
            </div>

            <Card title="All Courses" currentPalette={currentPalette}>
                <ul className="space-y-3 h-96 overflow-y-auto pr-2">
                {courses.length > 0 ? courses.map((course) => (
                    <li key={course._id}
                    className="p-4 rounded-lg"
                    style={{
                        backgroundColor: currentPalette['bg-primary'],
                        color: currentPalette['text-dark'],
                        boxShadow: `0 2px 8px ${currentPalette['shadow-light']}`
                    }}
                    >
                    <p className="font-semibold">{course.name}</p>
                    <p className="text-sm" style={{ color: currentPalette['text-muted'] }}>{course.code}</p>
                    <p className="text-xs mt-2" style={{ color: currentPalette['text-muted'] }}>
                        {new Date(course.startDate).toLocaleDateString()} - {new Date(course.endDate).toLocaleDateString()}
                    </p>
                    </li>
                )) : <p className="text-base" style={{ color: currentPalette['text-muted'] }}>No courses available.</p>}
                </ul>
            </Card>
            </div>
        );

      case 'batch':
        return (
          <div className="grid grid-cols-1 gap-8 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              <Card title="Add New Batch" currentPalette={currentPalette}>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>
                      Batch Name
                    </label>
                    <Input
                      currentPalette={currentPalette}
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Enter Batch Name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>
                      Select Course
                    </label>
                    <Select
                      currentPalette={currentPalette}
                      value={batchCourseCode}
                      onChange={(e) => setBatchCourseCode(e.target.value)}
                      required
                    >
                      <option value="">Select Course</option>
                      {courses.map((course: any) => (
                        <option key={course._id} value={course.code}>
                          {course.name} ({course.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                  {/* Instructor Dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>
                      Select Instructor
                    </label>
                    <Select
                      currentPalette={currentPalette}
                      value={batchInstructor}
                      onChange={(e) => setBatchInstructor(e.target.value)}
                      required
                    >
                      <option value="">Select Instructor</option>
                      {allUsers
                        .filter(user => user.role === 'teacher')
                        .map(user => (
                          <option key={user.email} value={user._id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="pt-2">
                    <Button 
                      onClick={handleAddBatch} 
                      variant="light-contrast"
                      currentPalette={currentPalette}
                    >
                      Add Batch
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Remove Batch" currentPalette={currentPalette}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: currentPalette['text-dark'] }}>
                      Select Batch
                    </label>
                    <Select
                      currentPalette={currentPalette}
                      value={batchToDelete}
                      onChange={(e) => setBatchToDelete(e.target.value)}
                      required
                    >
                      <option value="">Select Batch</option>
                      {batches.map((batch) => (
                        <option key={batch._id} value={batch._id}>
                          {batch.name} ({batch.course?.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button 
                    onClick={handleDeleteBatch} 
                    variant="danger"
                    currentPalette={currentPalette}
                  >
                    Remove Batch
                  </Button>
                </div>
              </Card>
            </div>

            <Card title="All Batches" currentPalette={currentPalette}>
              <ul className="space-y-3 h-96 overflow-y-auto pr-2">
                {batches.length > 0 ? (
                  batches.map((batch: any) => (
                    <li
                      key={batch._id}
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: currentPalette['bg-primary'],
                        color: currentPalette['text-dark'],
                        boxShadow: `0 2px 8px ${currentPalette['shadow-light']}`,
                      }}
                    >
                      <p className="font-semibold">{batch.name}</p>
                      <p className="text-sm" style={{ color: currentPalette['text-muted'] }}>
                        {batch.course?.name} ({batch.course?.code})
                      </p>
                      {/* Optionally show instructor */}
                      {batch.instructor && (
                        <p className="text-xs mt-1" style={{ color: currentPalette['text-muted'] }}>
                          Instructor: {batch.instructor.name} ({batch.instructor.email})
                        </p>
                      )}
                    </li>
                  ))
                ) : (
                  <p className="text-base" style={{ color: currentPalette['text-muted'] }}>
                    No batches available.
                  </p>
                )}
              </ul>
            </Card>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen relative overflow-hidden" style={{ background: currentPalette['bg-primary'] }}>
      {/* Subtle background pattern for visual interest */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='${encodeURIComponent(currentPalette['text-muted'])}' fill-opacity='0.1' fill-rule='evenodd'%3E%3Cpath d='M3 0L0 3l3 3 3-3z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
          background: `linear-gradient(135deg, ${currentPalette['bg-primary']} 0%, ${currentPalette['bg-primary']} 50%, ${currentPalette['bg-primary']} 100%)`
      }}></div>

      {showLogoutModal && (
        <Modal
        show={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Confirm Logout" 
        currentPalette={currentPalette}>
        Are you sure you want to log out?
        </Modal>
        )}

        {toastMessage && (
        <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setToastMessage('')}
            currentPalette={currentPalette}
        />
        )}

      {/* Sidebar */}
        <aside 
            className={`flex flex-col justify-between py-6 px-4 rounded-r-3xl transition-all duration-300 shadow-xl z-20 overflow-hidden ${showSidebar ? 'w-64' : 'w-20'}`}
            style={{
                backgroundColor: currentPalette['sidebar-bg'],
                backgroundImage: `linear-gradient(180deg, ${currentPalette['sidebar-bg']}, ${currentPalette['sidebar-bg']}E0)`,
                boxShadow: `8px 0 30px ${currentPalette['shadow-medium']}`
            }}
        >
          <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="self-start mb-6 p-2 border-2 border-transparent rounded-full active:scale-95 transition-transform duration-200 focus:outline-none focus:ring-2"
              style={{ borderColor: currentPalette['accent-lilac'], '--tw-ring-color': currentPalette['accent-lilac'] + '70' } as React.CSSProperties & Record<string, any>}
          >
              <span className="text-2xl" style={{ color: currentPalette['text-sidebar-dark'] }}>
                {showSidebar ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu">
                      <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
                    </svg>
                )}
              </span>
          </button>

          <div className="flex-1 flex flex-col items-center">
              <h2 className={`font-bold mb-10 mt-4 transition-all duration-300 ${showSidebar ? 'text-2xl' : 'text-lg'}`} style={{ color: currentPalette['text-sidebar-dark'] }}>
                  {showSidebar ? 'Admin Panel' : 'AP'}
              </h2>
              <ul className="space-y-3 w-full">
                <SidebarLink tabName="home" icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home">
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                } text="Home" />
                <SidebarLink tabName="course" icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open-text">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h6z"/><path d="M10 12H7"/><path d="M10 16H7"/>
                    </svg>
                } text="Course Manager" />
                <SidebarLink tabName="batch" icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box">
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
                    </svg>
                } text="Batch Manager" />
                <SidebarLink tabName="role" icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                } text="Role Manager" />
              </ul>
          </div>

          <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center justify-center gap-2 hover:opacity-80 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 mt-auto"
              style={{ color: currentPalette['text-sidebar-dark'], '--tw-ring-color': currentPalette['accent-lilac'] + '70' } as React.CSSProperties & Record<string, any>}
          >
              <span className={`${showSidebar ? 'mr-3 text-xl' : 'text-3xl'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="17 16 22 12 17 8"/><line x1="22" x2="10" y1="12" y2="12"/>
                  </svg>
              </span>
              {showSidebar && <span className="font-medium whitespace-nowrap">Logout</span>}
          </button>
        </aside>


      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 p-4">
        {/* Header */}
        <header 
            className="flex items-center justify-between p-4 rounded-xl w-full max-w-5xl mb-8 shadow-md"
            style={{ 
                backgroundColor: currentPalette['bg-secondary'],
                boxShadow: `0 4px 15px ${currentPalette['shadow-light']}`
            }}
        >
            <h1 className="text-xl font-bold uppercase" style={{ color: currentPalette['text-dark'] }}>{activeTab}</h1>
            <div className="flex items-center gap-4">
                {/* Dark mode toggle - placed at the bottom right of the main content area */}
                {/* To ensure it stays absolutely positioned relative to the main content area */}
                <div className="fixed bottom-6 right-6 z-30"> 
                    <button
                        onClick={() => setDarkMode(prev => !prev)}
                        className="h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{
                            backgroundColor: darkMode ? currentPalette['accent-purple'] : currentPalette['accent-lilac'],
                            color: 'white',
                            boxShadow: darkMode ? `0 4px 15px ${currentPalette['accent-purple']}60` : `0 4px 15px ${currentPalette['accent-lilac']}60`,
                            '--tw-ring-color': darkMode ? currentPalette['accent-purple'] + '70' : currentPalette['accent-lilac'] + '70'
                        } as React.CSSProperties & Record<string, any>}
                    >
                        <span className="w-6 h-6">
                            {darkMode ? (
                              <FiMoon className="w-6 h-6" />
                            ) : (
                              <FiSun className="w-6 h-6" />
                            )}
                        </span>
                    </button>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowProfilePopup(!showProfilePopup)}
                        className="p-2 flex items-center justify-center rounded-full border-2 border-transparent hover:border-blue-300 transition active:scale-95 bg-white shadow"
                        style={{ boxShadow: '0 2px 14px 0 rgba(87,65,141,0.16)' }}
                    >
                        <ProfileSVG />
                    </button>

                    {showProfilePopup && (
                        <div
                        className="absolute right-0 mt-3 w-80 p-4 z-50"
                        style={{
                            backgroundColor: currentPalette['bg-secondary'],
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomLeftRadius: 24,
                            borderBottomRightRadius: 24,
                            boxShadow: `0 4px 14px ${currentPalette['shadow-medium']}`,
                            color: currentPalette['text-dark']
                        }}
                        >
                        <h2 className="text-xl font-bold mb-4">Profile Info</h2>
                        <div className="space-y-2 mb-4 text-sm">
                            <p><strong>Name:</strong> {profileData.name}</p>
                            <p><strong>Email:</strong> {profileData.email}</p>
                            <p><strong>Role:</strong> {profileData.role}</p>
                        </div>
                        <button
                            onClick={() => setShowProfilePopup(false)}
                            className="w-full rounded-3xl px-4 py-2"
                            style={{
                            backgroundColor: currentPalette['accent-purple'],
                            color: 'white',
                            boxShadow: `0 4px 15px ${currentPalette['accent-purple']}40`
                            }}
                        >
                            OK
                        </button>
                        </div>
                    )}
                    </div>
                </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex justify-center items-start w-full max-w-5xl pb-8">
            <div className="w-full">
                {renderContent()}
            </div>
        </div>

      </main>
    </div>
  );
};

// A placeholder for a simple Login component if the user navigates to '/'
export default AdminDashboard;
