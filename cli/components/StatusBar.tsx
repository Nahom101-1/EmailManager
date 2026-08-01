import React from "react"
import { Box, Text } from "ink"

interface Props {
  model: string
  ollamaOk: boolean | null
  width: number
}

export function StatusBar({ model, ollamaOk, width }: Props) {
  const dot = ollamaOk === null ? "○" : ollamaOk ? "●" : "○"
  const dotColor = ollamaOk ? "green" : "gray"
  const right = `${dot} ${model}`
  const left = "LifeOS"
  const pad = Math.max(0, width - left.length - right.length - 4)

  const spacer = " ".repeat(pad)
  return (
    <Box paddingX={1}>
      <Text bold color="white" backgroundColor="blueBright">
        {left}
      </Text>
      <Text backgroundColor="blueBright">{spacer}</Text>
      <Text color={dotColor as "green" | "gray"} backgroundColor="blueBright">
        {dot}
      </Text>
      <Text color="white" backgroundColor="blueBright">
        {" "}
        {model}
      </Text>
    </Box>
  )
}
