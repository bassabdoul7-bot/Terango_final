import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../constants/colors';

const GlassButton = ({ 
  title, 
  onPress, 
  loading = false, 
  disabled = false,
  variant = 'primary', // primary (yellow), secondary (glass), danger (red)
  style 
}) => {
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return [COLORS.yellow, COLORS.yellow];
      case 'danger':
        return [COLORS.red, COLORS.red];
      case 'secondary':
        return ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.8)'];
      default:
        return [COLORS.yellow, COLORS.yellow];
    }
  };

  const getTextColor = () => {
    return variant === 'primary' ? COLORS.black : 
           variant === 'danger' ? COLORS.white : 
           COLORS.green;
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={getColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} />
        ) : (
          <Text style={[styles.text, { color: getTextColor() }]}>
            {title}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GlassButton;