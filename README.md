# VitalWatch Platform

**VitalWatch** is a comprehensive, AI-powered remote patient monitoring platform designed to manage Non-Communicable Diseases (NCDs) like diabetes and hypertension. It provides real-time health data from ESP32 devices, predictive alerts via Telegram, and dedicated portals for doctors, patients, and clinic administrators, all powered by a robust, dual-architecture backend with failover capabilities.

This project was built as a demonstration of a scalable, robust, and modern healthcare IoT solution.

---

## ✨ Core Features

The platform is divided into four main sections, each tailored to a specific user group:

### 🏠 Public-Facing Site
- **Landing Page:** Engaging introduction to the platform's mission and capabilities.
- **Detailed Feature & Tech Pages:** In-depth information on features, technology, and a step-by-step "How It Works" guide.
- **Role-Based Registration & Login:** Secure signup and login flows for doctors, patients, and clinic admins.

### 🧑‍⚕️ Doctor Portal
- **Clinical Dashboard:** A high-level overview of patient statistics, critical alerts, and recent activity.
- **Patient Management:** A searchable and filterable list of all assigned patients, with access to detailed health records.
- **Real-Time Alerts:** An intelligent notification center that prioritizes critical and predictive alerts for timely intervention.

### 🧑‍🦱 Patient Portal
- **Personal Dashboard:** A simplified, easy-to-understand view of current health status, active alerts, and medication reminders.
- **Health Data Tracking:** Interactive charts to explore historical glucose, blood pressure, and other vital trends.
- **Appointments & Communication:** A hub to manage appointments and receive advice from your care team.

### 👨‍💼 Admin Portal
- **System Overview:** Key metrics for the entire platform, including user counts, device status, and system health.
- **User & Device Management:** Tools to enroll new users (doctors, patients) and manage the lifecycle of monitoring devices.

---

## 🛠️ Technology Stack

VitalWatch is built with a modern, scalable, and secure technology stack:

- **Frontend:** [Next.js](https://nextjs.org/) with React (App Router) & [TypeScript](https://www.typescriptlang.org/)
- **UI:** [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)
- **Generative AI:**
    - **Primary:** [Google Gemini](https://deepmind.google.com/technologies/gemini/) via [Genkit](https://firebase.google.com/docs/genkit)
    - **Secondary/Failover:** Custom ML Models hosted on [Azure Functions](https://azure.microsoft.com/en-us/products/functions)
- **Database:** [GridDB](https://griddb.net/en/) via REST API
- **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🚀 Getting Started

To run the VitalWatch platform locally, follow these steps:

### 1. Install Dependencies

Make sure you have Node.js (v18 or higher) and npm installed. Then, run the following command in the project root:

```bash
npm install
```


### 3. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

### 4. Set Up the Telegram Webhook

For the Telegram bot to receive messages and commands, you need to configure the webhook. Replace the placeholders with your actual values:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_DEPLOYED_URL>/api/telegram/webhook"
```

**For local development with ngrok:**

```bash
# Start ngrok
ngrok http 3000

# Use the ngrok URL in the webhook command
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_NGROK_URL>/api/telegram/webhook"
```

### 5. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Next.js development server with hot reload |
| `npm run build` | Creates an optimized production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Lints the codebase for errors and style issues |
| `npm run genkit:dev` | Starts the Genkit development server for AI flow testing |

---

## 🔐 Security Best Practices

1. **Environment Variables:**
   - Never commit `.env.local` or any file containing secrets to version control
   - Use different credentials for development and production environments
   - Rotate API keys and secrets regularly

2. **API Keys:**
   - Store all sensitive keys in environment variables
   - Use Azure Key Vault or similar services for production secrets
   - Implement rate limiting on public API endpoints

3. **Device Authentication:**
   - Use strong, randomly generated API keys for device authentication
   - Implement device registration and revocation mechanisms
   - Monitor device activity for suspicious patterns

---

## 🏗️ Project Structure

```
VitalWatch/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── admin/             # Admin portal
│   ├── doctor/            # Doctor portal
│   ├── patient/           # Patient portal
│   └── api/               # API routes
├── components/            # Reusable React components
├── lib/                   # Utility functions and configurations
├── public/                # Static assets
├── genkit/                # Genkit AI flows
└── types/                 # TypeScript type definitions
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📞 Support

For questions or support, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation at [your-docs-url]

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI powered by [ShadCN UI](https://ui.shadcn.com/)
- AI capabilities by [Google Gemini](https://deepmind.google.com/technologies/gemini/)
- Time-series data managed by [GridDB](https://griddb.net/en/)

---

**Made with ❤️ for better healthcare monitoring**