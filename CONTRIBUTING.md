# Contributing to RoboCoach

Thank you for your interest in contributing to RoboCoach! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/robocoach.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your branch: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy Supabase functions (if needed)
cd supabase && supabase functions deploy llm-advice
```

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Add comments for complex logic
- Update documentation when needed

## Reporting Issues

Please use the GitHub Issues template when reporting bugs or requesting features.

## Pull Request Process

1. Ensure your code follows the existing style
2. Update the README.md if needed
3. Add or update tests if applicable
4. Ensure the build passes
5. Request review from maintainers

## Code of Conduct

Be respectful and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.