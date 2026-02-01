# VitalWatch Platform

**VitalWatch** is a comprehensive, AI-powered remote patient monitoring platform designed to manage Non-Communicable Diseases (NCDs) like diabetes and hypertension. It provides real-time health data from ESP32 devices, predictive alerts via Telegram, and dedicated portals for doctors, patients, and clinic administrators, all powered by a robust, dual-architecture backend with failover capabilities.

This project was built as a demonstration of a scalable, robust, and modern healthcare IoT solution.

---

## ✨ Core Features

The platform is divided into four main sections, each tailored to a specific user group:

#### 🏠 Public-Facing Site
- **Landing Page:** Engaging introduction to the platform's mission and capabilities.
- **Detailed Feature & Tech Pages:** In-depth information on features, technology, and a step-by-step "How It Works" guide.
- **Role-Based Registration & Login:** Secure signup and login flows for doctors, patients, and clinic admins.

#### 🧑‍⚕️ Doctor Portal
- **Clinical Dashboard:** A high-level overview of patient statistics, critical alerts, and recent activity.
- **Patient Management:** A searchable and filterable list of all assigned patients, with access to detailed health records.
- **Real-Time Alerts:** An intelligent notification center that prioritizes critical and predictive alerts for timely intervention.

#### 🧑‍🦱 Patient Portal
- **Personal Dashboard:** A simplified, easy-to-understand view of current health status, active alerts, and medication reminders.
- **Health Data Tracking:** Interactive charts to explore historical glucose, blood pressure, and other vital trends.
- **Appointments & Communication:** A hub to manage appointments and receive advice from the care team.

#### 👨‍💼 Admin Portal
- **System Overview:** Key metrics for the entire platform, including user counts, device status, and system health.
- **User & Device Management:** Tools to enroll new users (doctors, patients) and manage the lifecycle of monitoring devices.

---

## 🛠️ Technology Stack

VitalWatch is built with a modern, scalable, and secure technology stack:

- **Frontend:** [Next.js](https://nextjs.org/) with React (App Router) & [TypeScript](https://www.typescriptlang.org/)
- **UI:** [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)
- **Generative AI:**
    - **Primary:** [Google Gemini](https://deepmind.google.com/technologies/gemini/) via [Genkit](https://firebase.google.com/docs/genkit).
    - **Secondary/Failover:** Custom ML Models hosted on [Azure Functions](https://azure.microsoft.com/en-us/products/functions).
- **Database:** [GridDB](https://griddb.net/en/) via REST API
- **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🚀 Getting Started

To run the VitalWatch platform locally, follow these steps:

1.  **Install Dependencies:**
    Make sure you have Node.js and npm installed. Then, run the following command in the project root:
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**
    Create a `.env.local` file in the project root and add your credentials for the various services. Use the `.env` file as a template.
    ```env
    # For Google AI (Gemini) features
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

    # For Telegram alert notifications and bot functionality
    TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
    TELEGRAM_CHAT_ID="THE_TARGET_USER_CHAT_ID"
    
    # For GridDB connection
    GRIDDB_API_URL="https://cloud8737.griddb.com:443/griddb/v2/gs_clustermfcloud8737/dbs/32VcuKfC"
    GRIDDB_USERNAME="s01QS5qsRB-israel"
    GRIDDB_PASSWORD="israel"
    GRIDDB_TIMEOUT_MS=5000
    GRIDDB_RETRY_COUNT=3
    
    # The public URL of your deployed application (for webhooks, etc.)
    NEXT_PUBLIC_APP_URL="http://localhost:3000"

    # --- DUAL ARCHITECTURE ---
    # For Azure Function (Secondary AI Backend)
    AZURE_FUNCTION_BASE_URL="https://predict01-g4ecdyayb9czgtft.centralindia-01.azurewebsites.net"
    AZURE_FUNCTION_PREDICT_PATH="/api/predict"
    AZURE_FUNCTION_KEY="YOUR_AZURE_FUNCTION_KEY_HERE"
    AZURE_FUNCTION_TIMEOUT_MS=8000

    # Backend Control Flags
    PRIMARY_BACKEND="GEMINI" # Can be "GEMINI" or "AZURE"
    ENABLE_AZURE_BACKEND=true
    ENABLE_GEMINI_BACKEND=true
    BACKEND_FAILOVER_ENABLED=true

    # --- DEVICE & INTERNAL AUTH ---
    # Secret key to authenticate requests from physical devices
    DEVICE_API_KEY="VW_SECURE_2024_XYZ"
    # Secret to bypass auth for internal server-to-server API calls
    INTERNAL_API_SECRET="A_VERY_SECRET_INTERNAL_KEY"
    ```

3.  **Run the Development Server:**
    Start the Next.js development server:
    ```bash
    npm run dev
    ```

4.  **Set up the Telegram Webhook (Important for Bot Functionality):**
    For the Telegram bot to work, you need to tell Telegram where to send updates. Run the following command in your terminal, replacing `<YOUR_BOT_TOKEN>` and `<YOUR_VERCEL_URL>` with your actual bot token and your deployed Vercel URL (or a service like ngrok for local development).
    ```bash
    curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_URL>/api/telegram/webhook"
    ```

5.  **Access the Application:**
    Open your browser and navigate to `http://localhost:3000` to see the application in action.

---

## 📜 Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Creates a production-ready build of the application.
- `npm run start`: Starts the production server.
- `npm run lint`: Lints the codebase for errors and style issues.
- `npm run genkit:dev`: Starts the Genkit development server for AI flow testing.
