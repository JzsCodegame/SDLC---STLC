pipeline {
  agent any

  environment {
    IMAGE_NAME = 'mini-quiz-academy'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    STUDENTS_OUTPUT_FILE = 'students.json'
    MAX_STUDENTS = '20'
    MIN_QUESTIONS_PER_TOPIC = '25'
    QUESTION_COUNT = '25'
    OLLAMA_MODEL = 'qwen3:8b'
    OLLAMA_API_URL = 'http://host.docker.internal:11434/api/generate'
    SOURCE_DOCUMENT_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso'
    DEPLOY_COMMAND = ''
    ENABLE_DOCKER_STAGES = 'false'
  }

  triggers {
    cron('H 6,18 * * *')
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
      steps {
        catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
          sh '''
            set -eu

            if ! command -v docker >/dev/null 2>&1; then
              echo "Docker is required to run the Node question generator on this Jenkins agent."
              exit 2
            fi

            rm -f .question-generation-unstable
            echo "Generating questions.json with local Ollama ${OLLAMA_MODEL} at ${OLLAMA_API_URL}"

            set +e
            docker run --rm \
              --volumes-from jenkins \
              -w "$WORKSPACE" \
              -e OLLAMA_API_URL="$OLLAMA_API_URL" \
              -e OLLAMA_MODEL="$OLLAMA_MODEL" \
              -e STUDY_GUIDE_URL="$SOURCE_DOCUMENT_URL" \
              -e QUESTION_COUNT="$QUESTION_COUNT" \
              -e MIN_QUESTIONS_PER_TOPIC="$MIN_QUESTIONS_PER_TOPIC" \
              -e QUIZ_VARIANT_SEED="$(date -u +%Y-%m-%dT%H)" \
              -e OUTPUT_FILE=questions.json \
              -e STUDY_GUIDE_HASH_FILE=.study-guide.sha256 \
              -e UNSTABLE_MARKER_FILE=.question-generation-unstable \
              node:22-alpine \
              node scripts/generate-questions-local-ollama.js
            GENERATION_STATUS=$?
            set -e

            if [ "$GENERATION_STATUS" -ne 0 ]; then
              echo "Local Ollama generation failed; keeping previous questions.json."
              exit 2
            fi

            if [ -f .question-generation-unstable ]; then
              echo "Local Ollama generation completed with fallback notes:"
              cat .question-generation-unstable
              exit 2
            fi
          '''
        }
      }
    }

    stage('Deploy build') {
      when {
        expression { env.DEPLOY_COMMAND && env.DEPLOY_COMMAND != '' }
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
