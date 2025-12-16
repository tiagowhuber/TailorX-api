import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface UserAddressAttributes {
  id: number;
  user_id: number;
  recipient_name?: string;
  street_address: string;
  apartment_unit?: string;
  comuna: string;
  region: string;
  is_default: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface UserAddressCreationAttributes extends Optional<UserAddressAttributes, 'id' | 'created_at' | 'updated_at'> {}

class UserAddress extends Model<UserAddressAttributes, UserAddressCreationAttributes> implements UserAddressAttributes {
  public id!: number;
  public user_id!: number;
  public recipient_name?: string;
  public street_address!: string;
  public apartment_unit?: string;
  public comuna!: string;
  public region!: string;
  public is_default!: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

UserAddress.init(
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
        model: User,
        key: 'id',
      },
    },
    recipient_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    street_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    apartment_unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    comuna: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: 'user_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default UserAddress;
