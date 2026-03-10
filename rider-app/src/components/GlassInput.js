import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import COLORS from '../constants/colors';

const GlassInput = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder,
  keyboardType = 'default',
  maxLength,
  error,
  ...props 
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          keyboardType={keyboardType}
          maxLength={maxLength}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'LexendDeca_600SemiBold',
    color: COLORS.black,
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: COLORS.red,
  },
  input: {
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.black,
  , fontFamily: 'LexendDeca_400Regular' },
  errorText: {
    fontSize: 12,
    color: COLORS.red,
    marginTop: 4,
  , fontFamily: 'LexendDeca_400Regular' },
});

export default GlassInput;