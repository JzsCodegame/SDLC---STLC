pipeline {
  agent any

  environment {
    IMAGE_NAME = 'mini-quiz-academy'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    STUDENTS_OUTPUT_FILE = 'students.json'
    MAX_STUDENTS = '20'
    SOURCE_DOCUMENT_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso'
    DEPLOY_COMMAND = ''
    ENABLE_DOCKER_STAGES = 'false'
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
      when {
        expression { env.ENABLE_DOCKER_STAGES == 'true' }
      }
      steps {
        sh '''
          if ! command -v docker >/dev/null 2>&1; then
            echo "Docker is not installed on this Jenkins agent."
            echo "Install Docker or set ENABLE_DOCKER_STAGES=false to skip Docker build/deploy."
            exit 1
          fi

          docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
        '''
      }
    }

    stage('Archive generated students file') {
      steps {
        archiveArtifacts artifacts: "${STUDENTS_OUTPUT_FILE}", fingerprint: true
      }
    }

    stage('Generate AI quiz questions') {
      when {
        expression { env.ANTHROPIC_API_KEY != null && env.ANTHROPIC_API_KEY != '' }
      }
      steps {
        sh 'node scripts/generate-ai-questions.js'
      }
    }

    stage('Deploy build') {
      when {
        expression { env.DEPLOY_COMMAND != null && env.DEPLOY_COMMAND != '' }
      }
      steps {
        sh "${DEPLOY_COMMAND}"
      }
    }
  }

  post {
    success {
      echo 'Pipeline completed successfully. Students published and image built.'
    }
  }
}
