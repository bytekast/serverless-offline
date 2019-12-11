import { EOL } from 'os'
import fetch from 'node-fetch'
import { invokeJavaLocal } from 'java-invoke-local'

const { parse, stringify } = JSON
const { has } = Reflect

export default class JavaRunner {
  constructor(funOptions, env) {
    const {
      functionName,
      handler,
      servicePackage,
      functionPackage,
    } = funOptions

    this._env = env
    this._functionName = functionName
    this._handler = handler
    this._deployPackage = functionPackage || servicePackage
  }

  // no-op
  // () => void
  cleanup() {}

  _parsePayload(value) {
    for (const item of value.split(EOL)) {
      let json

      // first check if it's JSON
      try {
        json = parse(item)
        // nope, it's not JSON
      } catch (err) {
        // no-op
      }

      // now let's see if we have a property __offline_payload__
      if (
        json &&
        typeof json === 'object' &&
        has(json, '__offline_payload__')
      ) {
        return json.__offline_payload__
      }
    }

    return undefined
  }

  async run(event, context) {
    const input = stringify({
      context,
      event,
    })

    let result
    try {
      // Assume java-invoke-local server is running

      const data = stringify({
        artifact: this._deployPackage,
        handler: this._handler,
        data: input,
        function: this._functionName,
        jsonOutput: true,
        serverlessOffline: true,
      })

      const httpOptions = {
        method: 'POST',
        body: data,
      }

      const response = await fetch('http://localhost:8080/invoke', httpOptions)
      result = await response.text()
    } catch (e) {
      console.log(
        'Local java server not running. For faster local invocations, run "java-invoke-local --server" in your project directory',
      )

      // Fallback invocation

      const args = [
        '-c',
        this._handler,
        '-a',
        this._deployPackage,
        '-f',
        this._functionName,
        '-d',
        input,
        '--json-output',
        '--serverless-offline',
      ]

      result = invokeJavaLocal(args, this._env)
    }

    try {
      return this._parsePayload(result)
    } catch (err) {
      console.log(result)
      return err
    }
  }
}
