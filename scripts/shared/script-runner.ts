#!/usr/bin/env bun

import { Command, type OptionValues } from "commander"
import { type BootstrapOptions, bootstrap } from "./bootstrap"

export interface ScriptConfig {
  name: string
  description: string
  env?: string
  subcommands?: SubcommandConfig[]
}

export interface SubcommandConfig {
  name: string
  description: string
  handler: ScriptHandler
  options?: CommandSetup
}

export interface ScriptOptions extends OptionValues {
  verbose?: boolean
  [key: string]: any
}

export type ScriptHandler<T extends ScriptOptions = ScriptOptions> = (
  options: T,
  config: {
    rootFolder: string
    env: string
    parsedEnv: Record<string, string>
  },
) => Promise<void>

export type CommandSetup = (program: Command) => Command

/**
 * Common script runner that handles:
 * 1. Environment bootstrap
 * 2. CLI parsing with Commander
 * 3. Error handling
 * 4. Common options (verbose, help)
 */
export async function runScript<T extends ScriptOptions = ScriptOptions>(
  scriptConfig: ScriptConfig,
  handler: ScriptHandler<T>,
  options: T,
): Promise<void> {
  try {
    // Bootstrap environment
    const bootstrapOptions: BootstrapOptions = {
      env: scriptConfig.env,
      verbose: options.verbose || false,
    }

    const config = await bootstrap(bootstrapOptions)

    // Run the actual script handler
    await handler(options, config)
  } catch (error) {
    console.error(`❌ ${scriptConfig.name} failed:`, error)
    process.exit(1)
  }
}

/**
 * Standard script entry point using Commander
 */
export function createScriptRunner<T extends ScriptOptions = ScriptOptions>(
  scriptConfig: ScriptConfig,
  handler?: ScriptHandler<T>,
  setupCommand?: CommandSetup,
) {
  // Always set up the command - assume we're running as a script, not programmatic usage
  const program = new Command()

  program
    .name(scriptConfig.name.toLowerCase().replace(/\s+/g, "-"))
    .description(scriptConfig.description)
    .option("-v, --verbose", "enable verbose output")

  // Allow custom command setup for the main command
  const finalProgram = setupCommand ? setupCommand(program) : program

  // If subcommands are defined, register them
  if (scriptConfig.subcommands && scriptConfig.subcommands.length > 0) {
    for (const subcommand of scriptConfig.subcommands) {
      const cmd = finalProgram
        .command(subcommand.name)
        .description(subcommand.description)
        .option("-v, --verbose", "enable verbose output")

      // Apply subcommand-specific options
      const finalSubCmd = subcommand.options ? subcommand.options(cmd) : cmd

      finalSubCmd.action(async (options: T) => {
        await runScript(scriptConfig, subcommand.handler, options)
      })
    }

    // If there's a default handler, set it as the default action
    if (handler) {
      finalProgram.action(async (options: T) => {
        await runScript(scriptConfig, handler, options)
      })
    }
  } else {
    // No subcommands - use the original behavior
    if (!handler) {
      throw new Error("Handler is required when no subcommands are defined")
    }

    finalProgram.action(async (options: T) => {
      await runScript(scriptConfig, handler, options)
    })
  }

  finalProgram.parseAsync()

  // Return the handler for programmatic use (if needed)
  return {
    runScript: (opts: T) =>
      runScript(scriptConfig, handler || (() => Promise.resolve()), opts),
  }
}
