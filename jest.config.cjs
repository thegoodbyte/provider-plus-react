module.exports = {
  "transformIgnorePatterns": [
    "node_modules/(?!axios/|jspdf/|@babel/runtime/)"
  ],
  "collectCoverageFrom": [
    "src/services/api.ts",
    "src/services/cacheService.ts",
    "src/components/ReferralsPage.tsx",
    "src/components/bookingStep*.ts",
    "src/components/bookingStep*.tsx",
    "src/components/bookingRequirement*.ts",
    "src/components/BookingRequirementsPanel.tsx"
  ],
  "coverageThreshold": {
    "global": {
      "statements": 20,
      "branches": 20,
      "functions": 20,
      "lines": 20
    },
    "**/bookingRequirementsLoader.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingRequirementRows.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/useBookingRequirements.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingRequirementsPanel.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingMedicalOverviewData.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingMedicalOverviewPanel.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingCeremoniesPanel.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingTasksPanel.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingConfirmationWorkflow.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingConfirmationComposer.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/useBookingConfirmationPdf.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/useBookingConfirmationEmail.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingConfirmationEmailDialogs.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingOverviewPanel.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingDetailShell.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepActions.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepMedicalLinks.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepPresentation.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepIdentity.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepRows.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepIndexes.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepMedicalIndexes.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepControlRules.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepActionHistory.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepClientAvatar.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepMutations.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepPaymentSelection.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepReviewMutations.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepArtifactMutations.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepCommunicationRules.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepClientHeader.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepCommunicationModals.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepMedicalModals.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/bookingStepCellModel.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepCellEditor.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepMedicalControls.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepActionControls.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepsToolbar.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepsActionFilter.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepActionCheckRow.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepRowHeaders.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/BookingStepMatrixCell.tsx": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "**/cacheService.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    }
  },
  "testEnvironment": "jsdom",
  "roots": [
    "<rootDir>/src"
  ],
  "setupFilesAfterEnv": [
    "<rootDir>/src/setupTests.ts"
  ],
  "transform": {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  "moduleNameMapper": {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|ico)$": "<rootDir>/test/fileMock.cjs"
  },
  "testMatch": [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)"
  ],
  "resetMocks": true
};
