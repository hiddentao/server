FROM oven/bun:latest

ARG TARGETPLATFORM

WORKDIR /app

RUN echo "Building for $TARGETPLATFORM"

# Set the platform environment variable
ENV TARGETPLATFORM=${TARGETPLATFORM}

# Copy all Linux binaries from the build output
COPY dist/binaries/echo-linux-* /app/

# Select the correct binary for the target platform
RUN if [ "$TARGETPLATFORM" = "linux/amd64" ]; then \
      cp /app/echo-linux-x64 /app/echo; \
    else \
      cp /app/echo-linux-arm64 /app/echo; \
    fi

# Remove unused binaries to keep image size down
RUN rm -rf /app/echo-linux-*

# Make the binary executable
RUN chmod +x /app/echo

# Expose the application port
EXPOSE 3000

# Run the binary
ENTRYPOINT ["./echo"]