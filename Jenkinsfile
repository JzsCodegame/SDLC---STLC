pipeline {
  agent any

  environment {
    IMAGE_NAME = 'mini-quiz-academy'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    STUDENTS_OUTPUT_FILE = 'students.json'
    MAX_STUDENTS = '20'
    SOURCE_DOCUMENT_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Publish students from Google Sheet') {
      steps {
        sh '''
          if [ -z "$GOOGLE_SHEET_CSV_URL" ]; then
            echo "GOOGLE_SHEET_CSV_URL is not set. Configure it in Jenkins credentials/environment."
            exit 1
          fi

          node scripts/publish-students.js
        '''
      }
    }

    stage('Build Docker image') {
      steps {
        sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
      }
    }

    stage('Archive generated students file') {
      steps {
        archiveArtifacts artifacts: 'students.json', fingerprint: true
      }
    }
  }

  post {
    success {
      echo 'Pipeline completed successfully. Students published and image built.'
    }
  }
}
