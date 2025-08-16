# API-Members

A serverless AWS Lambda API for managing member data, characters, and related gaming resources for the POTP (Path of the Phoenix) platform.

## Overview

This API provides comprehensive member management functionality including character creation, profile management, image uploads, and access to gaming resources like classes, races, and auras. Built with TypeScript and designed for AWS Lambda with DynamoDB storage.

## Features

- **Member Management**: CRUD operations for member profiles
- **Character System**: Character creation and management
- **Image Handling**: Profile image upload and processing with Sharp
- **Gaming Resources**: Access to classes, races, auras, and groups
- **Session Tracking**: Track and count member gaming sessions
- **Authorization**: Role-based access control with AWS Cognito
- **CORS Support**: Full cross-origin resource sharing enabled

## Architecture

- **Runtime**: Node.js with TypeScript
- **Deployment**: AWS Lambda
- **Database**: Amazon DynamoDB
- **Storage**: Amazon S3 (for images)
- **Authentication**: AWS Cognito
- **Build**: TypeScript compilation with custom build scripts
- **Pattern**: Layered Architecture (Handler → Services → Repositories)

### Architecture Benefits

- **Separation of Concerns**: Clear separation between HTTP handling, business logic, and data access
- **Testability**: Each layer can be unit tested independently with dependency injection
- **Maintainability**: Business logic is centralized in service classes
- **Scalability**: Repository pattern abstracts data access for easy database changes
- **Type Safety**: Full TypeScript support throughout all layers

## API Endpoints

### Members
- `GET /members` - Get all members
- `GET /members/member/{id}` - Get specific member
- `POST /members/member` - Create new member
- `PUT /members/member/{id}` - Update member
- `PUT /members/member/{id}/image` - Update member image

### Characters
- `GET /members/characters` - Get user's characters
- `GET /members/characters?sub={userId}` - Get characters for specific user (admin)

### Resources
- `GET /members/classes` - Get available character classes
- `GET /members/races` - Get available character races
- `GET /members/auras` - Get available auras
- `GET /members/groups` - Get available groups

### Sessions
- `GET /members/sessions/{memberId}` - Get member's session data
- `GET /members/sessions/{memberId}/count` - Get session count

## Installation

1. Clone the repository:
```bash
git clone https://github.com/blechler/API-Members.git
cd API-Members
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Development

### Scripts

- `npm run build` - Build the TypeScript project
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run clean` - Clean build artifacts and dependencies

### Project Structure

The API follows a clean layered architecture pattern:

```
src/
├── handler.ts              # Main Lambda handler and routing
├── config/
│   └── database.ts         # DynamoDB configuration and table definitions
├── models/
│   └── member.ts           # TypeScript interfaces and type definitions
├── repositories/           # Data access layer
│   ├── memberRepository.ts # Member CRUD operations
│   ├── classRepository.ts  # Character classes data access
│   ├── raceRepository.ts   # Character races data access
│   ├── auraRepository.ts   # Aura data access
│   └── groupRepository.ts  # Group data access
├── services/               # Business logic layer
│   ├── memberService.ts    # Member business logic and validation
│   ├── imageService.ts     # Image processing and S3 operations
│   └── authService.ts      # Authentication and authorization
└── utils/
    └── mappingUtils.ts     # Data transformation and utility functions
```

## Authentication & Authorization

The API uses AWS Cognito for authentication with role-based access control. **All endpoints require authentication** - there are no public endpoints:

- **Authenticated Users**: Read access to resources (classes, races, auras) and member data
- **Member Access**: Read access to own characters and sessions  
- **Editor Access**: Create and modify members (requires `MemberEditors`, `Deity`, or `Administrator` groups)

Authentication is enforced at the API Gateway level, ensuring all requests are from authenticated users.

## Environment Setup

The API expects the following AWS resources:

- **DynamoDB Tables**:
  - Member data table
  - `potp-idx-report-member` (session tracking)
- **S3 Bucket**: For image storage
- **Cognito User Pool**: For authentication
- **Region**: ca-central-1

## Dependencies

### Production
- `@aws-sdk/client-dynamodb` - DynamoDB client
- `@aws-sdk/client-s3` - S3 client
- `@aws-sdk/lib-dynamodb` - DynamoDB document client
- `busboy` - Multipart form parsing
- `sharp` - Image processing
- `uuid` - UUID generation

### Development
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- `@types/*` - TypeScript definitions

## Deployment

The project uses custom build scripts for AWS Lambda deployment:

1. Run the build script: `./build.sh`
2. Deploy the generated `dist/` contents to AWS Lambda
3. Configure environment variables and IAM roles
4. Set up API Gateway integration

## Testing

Run the test suite:

```bash
npm test
```

For continuous testing during development:

```bash
npm run test:watch
```

## License

ISC