# 🤖 RoboCoach: SPIKE Prime AI Assistant

<div align="center">

![RoboCoach Logo](public/icons/robo128.png)

**AI-powered programming assistant for LEGO SPIKE Prime**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-brightgreen)]([https://chrome.google.com/webstore](https://chromewebstore.google.com/detail/RoboCoach:%20SPIKE%20Prime%20AI%20Assistant/mpijbplinejfdikkigljnleapgmhmicp))
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/roboyouthtaiwan/robocoach)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Transform your SPIKE Prime programming experience with intelligent AI assistance that understands your code and provides real-time guidance.

[🚀 **Install Extension**](#installation) • [📖 **Documentation**](#features) • [🛠️ **Development**](#development) • [🤝 **Support**](#support)

</div>

---

## ✨ Features

### 🎯 **Smart Troubleshooting**
- **Real-time block analysis** - Automatically detects and analyzes your SPIKE Prime program
- **Contextual debugging** - Provides specific advice based on your actual code structure  
- **Common issue detection** - Identifies motor problems, sensor issues, control flow errors
- **Bilingual support** - Full English and Traditional Chinese interface

### 🧩 **AI Code Generation**
- **Natural language to blocks** - Convert plain English/Chinese to SPIKE Prime block sequences
- **Pattern optimization** - Specialized handling for "move until condition then stop" patterns
- **Best practices** - Automatically generates proper loop structures and control flow
- **Educational focus** - Explains the generated code for learning

### 💬 **Interactive AI Chat**
- **Context-aware conversations** - AI understands your current program state
- **Programming concept explanations** - Learn SPIKE Prime concepts through dialogue
- **Debug assistance** - Get help with complex programming challenges
- **Real-time block context** - AI references your actual blocks in responses

### 🔍 **Intelligent Analysis**
- **Block categorization** - Automatically organizes motors, sensors, control structures
- **Performance suggestions** - Optimization recommendations for speed and efficiency
- **Error prevention** - Warns about common programming mistakes before they happen
- **Program flow visualization** - Clear summary of what your robot will do

---

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store Extension Page]([https://chrome.google.com/webstore](https://chromewebstore.google.com/detail/RoboCoach:%20SPIKE%20Prime%20AI%20Assistant/mpijbplinejfdikkigljnleapgmhmicp))
2. Click "Add to Chrome"
3. Navigate to [spike.legoeducation.com](https://spike.legoeducation.com)
4. Click the RoboCoach extension icon

### Manual Installation (Development)
1. Clone this repository
2. Build the extension
3. Load in Chrome Developer Mode

---

## 🎓 How to Use

### 1. **Getting Started**
```
1. Install the extension
2. Go to spike.legoeducation.com
3. Create or open a SPIKE Prime project
4. Click the RoboCoach icon in your browser toolbar
```

### 2. **Smart Troubleshooting**
- Select common issues from the grid
- Get instant analysis of your current blocks
- Receive contextual advice based on your program

### 3. **AI Chat**
- Ask questions about SPIKE Prime programming
- Get explanations tailored to your current code
- Debug complex issues with intelligent assistance

### 4. **Code Generation**
- Describe what you want your robot to do in plain language
- Get complete block sequences generated automatically
- Learn best practices through explained examples

---

## 🛠️ Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Chrome browser for testing

### Setup
```bash
# Clone the repository
git clone https://github.com/roboyouthtaiwan/robocoach.git
cd robocoach

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Project Structure
```
roboteach/
├── src/
│   ├── popup/          # Main extension UI (React + TypeScript)
│   ├── content/        # Content script for SPIKE website
│   └── assets/         # Static assets
├── supabase/
│   └── functions/      # AI backend functions
├── public/
│   └── icons/          # Extension icons
└── dist/               # Built extension files
```

### Technologies Used
- **Frontend**: React, TypeScript, Vite
- **Backend**: Supabase Edge Functions, Deno
- **AI**: OpenAI GPT-4o-mini
- **Build**: Vite with web extension plugin
- **Styling**: Modern CSS with CSS Variables

---

## 🎯 For Educators

RoboCoach is designed with education in mind:

- **Scaffolded Learning** - Provides hints without giving away solutions
- **Conceptual Explanations** - Helps students understand programming concepts
- **Error Analysis** - Teaches debugging skills through guided problem-solving
- **Bilingual Support** - Accessible to diverse student populations
- **Real-time Feedback** - Immediate assistance during programming activities

---

## 🔒 Privacy & Security

- **No personal data collection** - Only analyzes block code for assistance
- **Secure processing** - All AI calls use encrypted HTTPS
- **Limited scope** - Only works on spike.legoeducation.com
- **Open source** - Code is publicly auditable

---

## 🤝 Support

### Getting Help
- **Email**: roboyouthtaiwan@gmail.com
- **Issues**: [GitHub Issues](https://github.com/roboyouthtaiwan/robocoach/issues)
- **Discussions**: [GitHub Discussions](https://github.com/roboyouthtaiwan/robocoach/discussions)

### Contributing
We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Reporting Bugs
Please use our [Issue Template](.github/ISSUE_TEMPLATE/bug_report.md) when reporting bugs.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 Acknowledgments

- **LEGO Education** - For creating the amazing SPIKE Prime platform
- **OpenAI** - For providing the AI capabilities that power our assistant
- **Supabase** - For the reliable backend infrastructure
- **React & Vite Communities** - For the excellent development tools

---

<div align="center">

**Built with ❤️ by Sophie Hsu @ RoboYouth Taiwan**

*Empowering the next generation of robotics programmers!*

</div>
