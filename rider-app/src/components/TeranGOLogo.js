import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import COLORS from '../constants/colors';

const TeranGOLogo = ({ size = 120 }) => {
  return (
    <View style={[styles.container, { width: size + 40, height: size + 60 }]}>
      {/* SVG Logo */}
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {/* Outer Green Circle */}
        <Circle cx="60" cy="60" r="58" stroke={COLORS.green} strokeWidth="3" fill="white" />
        
        {/* Inner Circle Path (Road) */}
        <Path
          d="M 20 60 Q 60 90, 100 60"
          stroke={COLORS.green}
          strokeWidth="2"
          fill="none"
        />
        
        {/* Baobab Tree - Left Side */}
        <Path
          d="M 30 65 L 30 45 M 25 48 L 35 48 M 25 50 L 35 50 M 28 45 L 28 40 L 32 40 L 32 45"
          stroke={COLORS.green}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Yellow Car - Right Side */}
        <G transform="translate(55, 45)">
          {/* Car Body */}
          <Path
            d="M 0 10 L 5 5 L 15 5 L 20 10 L 20 15 L 0 15 Z"
            fill="#DAA520"
            stroke="#DAA520"
            strokeWidth="1"
          />
          {/* Car Windows */}
          <Path
            d="M 6 7 L 9 7 L 9 10 L 6 10 Z M 12 7 L 15 7 L 15 10 L 12 10 Z"
            fill="white"
          />
          {/* Wheels */}
          <Circle cx="5" cy="15" r="2" fill={COLORS.gray} />
          <Circle cx="15" cy="15" r="2" fill={COLORS.gray} />
        </G>
        
        {/* Yellow Star - Top */}
        <Path
          d="M 60 20 L 62 26 L 68 26 L 63 30 L 65 36 L 60 32 L 55 36 L 57 30 L 52 26 L 58 26 Z"
          fill={COLORS.yellow}
          stroke={COLORS.yellow}
        />
      </Svg>
      
      {/* TeranGO Text */}
      <View style={styles.textContainer}>
        <Text style={styles.logoText}>
          <Text style={styles.teran}>Teran</Text>
          <Text style={styles.go}>GO</Text>
        </Text>
        <Text style={styles.tagline}>La teranga sénégalaise vous accompagne</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teran: {
    color: COLORS.green,
  },
  go: {
    color: '#DAA520', // Gold color
  },
  tagline: {
    fontSize: 11,
    color: '#DAA520',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TeranGOLogo;