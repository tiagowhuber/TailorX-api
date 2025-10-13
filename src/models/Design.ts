import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface DesignAttributes {
  id: number;
  name: string;
  description?: string;
  freesewing_pattern?: string;
  base_price: number;
  image_url?: string;
  default_settings?: object;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface DesignCreationAttributes extends Optional<DesignAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Design extends Model<DesignAttributes, DesignCreationAttributes> implements DesignAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public freesewing_pattern?: string;
  public base_price!: number;
  public image_url?: string;
  public default_settings?: object;
  public is_active?: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

Design.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    freesewing_pattern: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    default_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'designs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Design;