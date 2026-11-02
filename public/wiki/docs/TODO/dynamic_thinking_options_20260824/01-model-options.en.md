# Model Options Model

The old implementation compressed all models into five integers, 1 to 5. The new implementation uses a string id to represent a real Provider option; a mapping can have any number of options, or it can be a switch-only control.

Each option simultaneously carries display text, a line value, and a request path. The Provider only reads the thinking rules in the current model configuration, and writes the selected action into the request parameters. Built-in rules are written into the model configuration when a new configuration is created or when switching providers.
