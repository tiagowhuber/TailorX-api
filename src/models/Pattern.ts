import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PatternAttributes {
  id: number;
  user_id: number;
  design_id: number;
  name?: string;
  measurements_used: object;
  settings_used: object;
  svg_data: string;
  svg_size_kb?: number;
  status?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface PatternCreationAttributes extends Optional<PatternAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Pattern extends Model<PatternAttributes, PatternCreationAttributes> implements PatternAttributes {
  public id!: number;
  public user_id!: number;
  public design_id!: number;
  public name?: string;
  public measurements_used!: object;
  public settings_used!: object;
  public svg_data!: string;
  public svg_size_kb?: number;
  public status?: string;
  public created_at?: Date;
  public updated_at?: Date;
  public design?: any;
}

Pattern.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    design_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'designs',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    measurements_used: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    settings_used: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    svg_data: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    svg_size_kb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'draft',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'patterns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['design_id'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default Pattern;